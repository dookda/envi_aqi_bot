"""
LINE Push Notification Service

Sends push notifications to administrators when:
- Spike/anomaly data is detected in uploaded CSV
- Missing data gaps are found
- Data quality issues are identified

Supports Thai and English messages.
"""

import os
from typing import List, Dict, Any, Optional
from datetime import datetime
from linebot.v3.messaging import (
    Configuration, ApiClient, MessagingApi,
    PushMessageRequest, TextMessage, FlexMessage, FlexContainer
)

from backend_model.logger import logger


class LineNotificationService:
    """Service for sending LINE push notifications to administrators"""

    def __init__(self):
        self.channel_access_token = os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "")
        self.admin_user_ids = self._parse_admin_ids()
        self.enabled = bool(self.channel_access_token and self.admin_user_ids)
        
        if self.enabled:
            self.configuration = Configuration(access_token=self.channel_access_token)
            logger.info(f"LINE Notification Service initialized with {len(self.admin_user_ids)} admin(s)")
        else:
            self.configuration = None
            if not self.channel_access_token:
                logger.warning("LINE Notification Service disabled: No LINE_CHANNEL_ACCESS_TOKEN")
            if not self.admin_user_ids:
                logger.warning("LINE Notification Service disabled: No LINE_ADMIN_USER_IDS configured")

    def _parse_admin_ids(self) -> List[str]:
        """Parse admin user IDs from environment variable (comma-separated)"""
        admin_ids_str = os.getenv("LINE_ADMIN_USER_IDS", "")
        if not admin_ids_str:
            return []
        return [uid.strip() for uid in admin_ids_str.split(",") if uid.strip()]

    def send_upload_quality_alert(
        self,
        station_id: str,
        station_name: Optional[str],
        upload_summary: Dict[str, Any],
        language: str = "th"
    ) -> bool:
        """
        Send upload quality alert to all admin users
        
        Args:
            station_id: Station identifier
            station_name: Station display name
            upload_summary: Summary dict containing:
                - total_records: Total uploaded records
                - inserted: Successfully inserted
                - failed: Failed records
                - spike_count: Number of spikes detected
                - missing_gaps: Number of missing data gaps
                - missing_hours: Total hours of missing data
                - imputed_count: Auto-imputed records
                - coverage_percent: Data coverage percentage
                - date_range: (start_date, end_date) tuple
                - anomaly_details: List of anomaly info
            language: 'th' or 'en'
            
        Returns:
            True if notification sent successfully
        """
        if not self.enabled:
            logger.debug("LINE notifications disabled, skipping alert")
            return False

        # Check if there's anything to alert about
        spike_count = upload_summary.get("spike_count", 0)
        missing_hours = upload_summary.get("missing_hours", 0)
        failed = upload_summary.get("failed", 0)
        
        # Only send alert if there are issues
        if spike_count == 0 and missing_hours == 0 and failed == 0:
            logger.debug("No quality issues found, skipping LINE alert")
            return False

        # Build message
        message = self._build_quality_alert_message(
            station_id=station_id,
            station_name=station_name,
            upload_summary=upload_summary,
            language=language
        )

        # Send to all admins
        success = True
        for user_id in self.admin_user_ids:
            try:
                self._send_push_message(user_id, message)
                logger.info(f"Sent quality alert to admin {user_id[:8]}...")
            except Exception as e:
                logger.error(f"Failed to send alert to {user_id}: {e}")
                success = False

        return success

    def _build_quality_alert_message(
        self,
        station_id: str,
        station_name: Optional[str],
        upload_summary: Dict[str, Any],
        language: str = "th"
    ) -> str:
        """Build the alert message text"""
        
        display_name = station_name or station_id
        spike_count = upload_summary.get("spike_count", 0)
        missing_hours = upload_summary.get("missing_hours", 0)
        missing_gaps = upload_summary.get("missing_gaps", 0)
        imputed_count = upload_summary.get("imputed_count", 0)
        coverage_percent = upload_summary.get("coverage_percent", 100)
        total_records = upload_summary.get("total_records", 0)
        inserted = upload_summary.get("inserted", 0)
        failed = upload_summary.get("failed", 0)
        date_range = upload_summary.get("date_range", (None, None))
        anomaly_details = upload_summary.get("anomaly_details", [])

        if language == "th":
            # Thai message
            lines = [
                "🚨 การแจ้งเตือนคุณภาพข้อมูล",
                "",
                f"📍 สถานี: {display_name}",
                f"🆔 รหัส: {station_id}",
            ]
            
            # Date range
            if date_range[0] and date_range[1]:
                lines.append(f"📅 ช่วงเวลา: {date_range[0]} ถึง {date_range[1]}")
            
            lines.append("")
            lines.append(f"📊 สรุปการอัปโหลด:")
            lines.append(f"• ข้อมูลทั้งหมด: {total_records} รายการ")
            lines.append(f"• นำเข้าสำเร็จ: {inserted} รายการ")
            
            if failed > 0:
                lines.append(f"• ❌ นำเข้าล้มเหลว: {failed} รายการ")
            
            # Quality issues section
            if spike_count > 0 or missing_hours > 0:
                lines.append("")
                lines.append("⚠️ พบปัญหาคุณภาพข้อมูล:")
                
                if spike_count > 0:
                    lines.append(f"• 🔺 ค่าผิดปกติ (Spike): {spike_count} จุด")
                    
                    # Add top anomaly details
                    if anomaly_details:
                        for detail in anomaly_details[:3]:
                            dt = detail.get("datetime", "")
                            value = detail.get("value", 0)
                            param = detail.get("parameter", "PM2.5")
                            lines.append(f"   └─ {dt}: {param} = {value:.1f}")
                
                if missing_hours > 0:
                    lines.append(f"• ⏳ ข้อมูลขาดหาย: {missing_hours} ชั่วโมง ({missing_gaps} ช่วง)")
                
                lines.append(f"• 📈 ความครอบคลุมข้อมูล: {coverage_percent:.1f}%")
            
            # Auto-imputation info
            if imputed_count > 0:
                lines.append("")
                lines.append(f"🤖 ระบบเติมค่าอัตโนมัติ: {imputed_count} จุด")
            
            # Recommendations
            lines.append("")
            lines.append("📋 คำแนะนำ:")
            if spike_count > 0:
                lines.append("• ตรวจสอบค่าที่ผิดปกติในระบบ")
            if missing_hours > 0:
                lines.append("• ตรวจสอบสาเหตุของข้อมูลขาดหาย")
            if spike_count > 0 or missing_hours > 0:
                lines.append("• เข้าระบบเพื่อดูรายละเอียดเพิ่มเติม")
            
        else:
            # English message
            lines = [
                "🚨 Data Quality Alert",
                "",
                f"📍 Station: {display_name}",
                f"🆔 ID: {station_id}",
            ]
            
            if date_range[0] and date_range[1]:
                lines.append(f"📅 Period: {date_range[0]} to {date_range[1]}")
            
            lines.append("")
            lines.append("📊 Upload Summary:")
            lines.append(f"• Total records: {total_records}")
            lines.append(f"• Inserted: {inserted}")
            
            if failed > 0:
                lines.append(f"• ❌ Failed: {failed}")
            
            if spike_count > 0 or missing_hours > 0:
                lines.append("")
                lines.append("⚠️ Quality Issues Detected:")
                
                if spike_count > 0:
                    lines.append(f"• 🔺 Spikes/Anomalies: {spike_count} points")
                    
                    if anomaly_details:
                        for detail in anomaly_details[:3]:
                            dt = detail.get("datetime", "")
                            value = detail.get("value", 0)
                            param = detail.get("parameter", "PM2.5")
                            lines.append(f"   └─ {dt}: {param} = {value:.1f}")
                
                if missing_hours > 0:
                    lines.append(f"• ⏳ Missing data: {missing_hours} hours ({missing_gaps} gaps)")
                
                lines.append(f"• 📈 Coverage: {coverage_percent:.1f}%")
            
            if imputed_count > 0:
                lines.append("")
                lines.append(f"🤖 Auto-imputed: {imputed_count} points")
            
            lines.append("")
            lines.append("📋 Recommendations:")
            if spike_count > 0:
                lines.append("• Review anomalous values in dashboard")
            if missing_hours > 0:
                lines.append("• Investigate cause of data gaps")
            if spike_count > 0 or missing_hours > 0:
                lines.append("• Check details in the admin panel")

        return "\n".join(lines)

    def _send_push_message(self, user_id: str, message: str) -> None:
        """Send push message to a specific user"""
        if not self.configuration:
            raise RuntimeError("LINE API not configured")

        # Truncate if too long (LINE limit: 5000 chars)
        if len(message) > 4900:
            message = message[:4900] + "\n\n... (truncated)"

        with ApiClient(self.configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            line_bot_api.push_message(
                PushMessageRequest(
                    to=user_id,
                    messages=[TextMessage(text=message)]
                )
            )

    def send_simple_alert(
        self,
        title: str,
        message: str,
        user_ids: Optional[List[str]] = None
    ) -> bool:
        """
        Send a simple text alert
        
        Args:
            title: Alert title
            message: Alert message body
            user_ids: Specific user IDs (defaults to all admins)
        """
        if not self.enabled:
            return False

        target_users = user_ids or self.admin_user_ids
        full_message = f"{title}\n\n{message}"

        success = True
        for user_id in target_users:
            try:
                self._send_push_message(user_id, full_message)
            except Exception as e:
                logger.error(f"Failed to send simple alert to {user_id}: {e}")
                success = False

        return success

    def health_check(self) -> Dict[str, Any]:
        """Check service health status"""
        return {
            "enabled": self.enabled,
            "admin_count": len(self.admin_user_ids),
            "has_token": bool(self.channel_access_token),
        }


# Singleton instance
line_notification_service = LineNotificationService()
