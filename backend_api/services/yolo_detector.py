"""
YOLO Object Detection Service for CCTV Monitoring

Detects objects in video frames using YOLOv8 model.
Tracks: humans, vehicles (car, motorcycle, bicycle), and animals.
"""

import cv2
import numpy as np
import torch
from typing import List, Dict, Any, Optional
from backend_model.logger import logger
import time
from backend_api.services.notification import NotificationService

# Fix for PyTorch 2.6+ weights_only default change
# Ultralytics models require weights_only=False due to custom classes
_original_torch_load = torch.load


def _patched_torch_load(*args, **kwargs):
    """Patched torch.load that defaults to weights_only=False for compatibility"""
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _original_torch_load(*args, **kwargs)


torch.load = _patched_torch_load

from ultralytics import YOLO


class YOLODetectorService:
    """YOLO-based object detection service for CCTV monitoring"""

    # COCO class IDs for objects we want to detect
    TARGET_CLASSES = {
        "human": [0],  # person
        "car": [2],  # car
        "motorcycle": [3],  # motorcycle
        "bicycle": [1],  # bicycle
        "animal": [14, 15, 16, 17, 18, 19, 20, 21, 22, 23],  # Various animals from COCO
        "fire": []  # Fire/smoke detection (requires custom model training)
    }

    # COCO class names
    COCO_NAMES = {
        0: "person", 1: "bicycle", 2: "car", 3: "motorcycle",
        14: "bird", 15: "cat", 16: "dog", 17: "horse", 18: "sheep",
        19: "cow", 20: "elephant", 21: "bear", 22: "zebra", 23: "giraffe"
    }

    def __init__(self, model_name: str = "yolov8n.pt", confidence_threshold: float = 0.5):
        """
        Initialize YOLO detector

        Args:
            model_name: YOLO model variant (yolov8n, yolov8s, yolov8m, yolov8l, yolov8x)
            confidence_threshold: Minimum confidence for detections (0-1)
        """
        self.model_name = model_name
        self.confidence_threshold = confidence_threshold
        self.model: Optional[YOLO] = None
        self.last_notification_time = {}  # Cooldown tracker per category
        self._init_model()

    def _init_model(self):
        """Initialize YOLO model (lazy loading)"""
        try:
            logger.info(f"Loading YOLO model: {self.model_name}")
            self.model = YOLO(self.model_name)
            logger.info(f"YOLO model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            raise

    def _classify_detection(self, class_id: int) -> Optional[str]:
        """
        Classify COCO class ID into our target categories

        Args:
            class_id: COCO class ID

        Returns:
            Category name ('human', 'car', 'motorcycle', 'bicycle', 'animal') or None
        """
        for category, ids in self.TARGET_CLASSES.items():
            if class_id in ids:
                return category
        return None

    def detect_frame(self, frame_data: bytes) -> Dict[str, Any]:
        """
        Detect objects in a single video frame

        Args:
            frame_data: JPEG/PNG encoded image bytes

        Returns:
            Dictionary containing detections and statistics
        """
        start_time = time.time()

        try:
            # Decode image
            nparr = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                return {
                    "success": False,
                    "error": "Failed to decode image",
                    "detections": [],
                    "statistics": {}
                }

            # Run YOLO detection
            results = self.model(frame, conf=self.confidence_threshold, verbose=False)

            # Process detections
            detections = []
            stats = {"human": 0, "car": 0, "motorcycle": 0, "bicycle": 0, "animal": 0, "fire": 0, "total": 0}

            for result in results:
                boxes = result.boxes

                for box in boxes:
                    # Get detection info
                    class_id = int(box.cls[0])
                    confidence = float(box.conf[0])
                    bbox = box.xyxy[0].tolist()  # [x1, y1, x2, y2]

                    # Classify detection
                    category = self._classify_detection(class_id)

                    if category:
                        # Convert bbox to relative coordinates (0-1)
                        h, w = frame.shape[:2]
                        x1, y1, x2, y2 = bbox

                        detection = {
                            "type": category,
                            "confidence": round(confidence, 3),
                            "bbox": {
                                "x": round(x1 / w, 4),
                                "y": round(y1 / h, 4),
                                "width": round((x2 - x1) / w, 4),
                                "height": round((y2 - y1) / h, 4)
                            },
                            "class_name": self.COCO_NAMES.get(class_id, f"class_{class_id}")
                        }

                        detections.append(detection)
                        stats[category] += 1
                        stats["total"] += 1

            # === Notification Logic (TOR 16.5) ===
            current_time = time.time()
            
            # Notify on Fire
            if stats["fire"] > 0:
                last_time = self.last_notification_time.get("fire", 0)
                if current_time - last_time > 300:  # 5 minute cooldown
                    NotificationService.create_notification(
                        title="🔥 Fire Detected!",
                        message=f"Warning: {stats['fire']} potential fire source(s) detected on CCTV.",
                        type="critical"
                    )
                    self.last_notification_time["fire"] = current_time
            
            # Notify on Wild Animal
            if stats["animal"] > 0:
                last_time = self.last_notification_time.get("animal", 0)
                if current_time - last_time > 600:  # 10 minute cooldown
                    NotificationService.create_notification(
                        title="🐾 Animal Detected",
                        message=f"Detected {stats['animal']} animal(s) in the monitoring area.",
                        type="info"
                    )
                    self.last_notification_time["animal"] = current_time

            processing_time = time.time() - start_time

            return {
                "success": True,
                "detections": detections,
                "statistics": stats,
                "processing_time_ms": round(processing_time * 1000, 2),
                "frame_size": {"width": frame.shape[1], "height": frame.shape[0]}
            }

        except Exception as e:
            logger.error(f"Error detecting objects in frame: {e}")
            return {
                "success": False,
                "error": str(e),
                "detections": [],
                "statistics": {}
            }

    def get_model_info(self) -> Dict[str, Any]:
        """Get information about loaded model"""
        if not self.model:
            return {"loaded": False}

        return {
            "loaded": True,
            "model_name": self.model_name,
            "confidence_threshold": self.confidence_threshold,
            "target_categories": list(self.TARGET_CLASSES.keys()),
            "coco_classes_tracked": sum(len(ids) for ids in self.TARGET_CLASSES.values())
        }


# Global singleton instance
_yolo_detector_instance: Optional[YOLODetectorService] = None


def get_yolo_detector() -> YOLODetectorService:
    """Get or create global YOLO detector instance"""
    global _yolo_detector_instance

    if _yolo_detector_instance is None:
        _yolo_detector_instance = YOLODetectorService(
            model_name="yolov8n.pt",  # Nano model for speed
            confidence_threshold=0.5
        )

    return _yolo_detector_instance
