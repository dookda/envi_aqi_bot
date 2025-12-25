"""
Region Matcher for Location-Based Services (LBS)

Provides geographic search capabilities:
- Region-based search (Northern, Southern, Central Thailand, etc.)
- Province grouping
- Bounding box queries using coordinates
- Distance-based proximity search
"""

from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from backend_model.logger import logger


@dataclass
class Region:
    """Geographic region definition"""
    name_en: str
    name_th: str
    aliases: List[str]
    provinces: List[str]  # Province names included in this region
    bounding_box: Optional[Tuple[float, float, float, float]] = None  # min_lat, min_lon, max_lat, max_lon


# =============================================================================
# THAILAND REGIONS WITH PROVINCES AND BOUNDING BOXES
# =============================================================================

THAILAND_REGIONS: Dict[str, Region] = {
    "northern": Region(
        name_en="Northern Thailand",
        name_th="ภาคเหนือ",
        aliases=[
            "north", "northern", "northern thailand", "north thailand",
            "ภาคเหนือ", "เหนือ", "ทางเหนือ", "แถบเหนือ", "พื้นที่ภาคเหนือ"
        ],
        provinces=[
            "Chiang Mai", "Chiang Rai", "Lampang", "Lamphun", "Mae Hong Son",
            "Nan", "Phayao", "Phrae", "Uttaradit",
            # Thai names
            "เชียงใหม่", "เชียงราย", "ลำปาง", "ลำพูน", "แม่ฮ่องสอน",
            "น่าน", "พะเยา", "แพร่", "อุตรดิตถ์"
        ],
        bounding_box=(17.5, 97.5, 20.5, 101.5)  # Approximate Northern Thailand
    ),
    
    "northeastern": Region(
        name_en="Northeastern Thailand (Isan)",
        name_th="ภาคตะวันออกเฉียงเหนือ (อีสาน)",
        aliases=[
            "northeast", "northeastern", "isan", "isaan", "esarn",
            "northeastern thailand", "northeast thailand",
            "ภาคตะวันออกเฉียงเหนือ", "อีสาน", "ภาคอีสาน", "ตะวันออกเฉียงเหนือ"
        ],
        provinces=[
            "Khon Kaen", "Udon Thani", "Nakhon Ratchasima", "Ubon Ratchathani",
            "Buriram", "Surin", "Roi Et", "Maha Sarakham", "Kalasin", "Sakon Nakhon",
            "Nakhon Phanom", "Mukdahan", "Loei", "Nong Khai", "Nong Bua Lamphu",
            "Amnat Charoen", "Yasothon", "Sisaket", "Chaiyaphum",
            # Thai names
            "ขอนแก่น", "อุดรธานี", "นครราชสีมา", "อุบลราชธานี", "บุรีรัมย์",
            "สุรินทร์", "ร้อยเอ็ด", "มหาสารคาม", "กาฬสินธุ์", "สกลนคร"
        ],
        bounding_box=(14.0, 101.5, 18.5, 106.0)
    ),
    
    "central": Region(
        name_en="Central Thailand",
        name_th="ภาคกลาง",
        aliases=[
            "central", "central thailand", "center", "กลาง",
            "ภาคกลาง", "ตอนกลาง", "ส่วนกลาง"
        ],
        provinces=[
            "Bangkok", "Nonthaburi", "Pathum Thani", "Samut Prakan",
            "Ayutthaya", "Ang Thong", "Lopburi", "Saraburi", "Singburi",
            "Chainat", "Nakhon Nayok", "Suphan Buri", "Nakhon Pathom",
            "Samut Sakhon", "Samut Songkhram",
            # Thai names
            "กรุงเทพ", "นนทบุรี", "ปทุมธานี", "สมุทรปราการ", "อยุธยา",
            "สระบุรี", "นครปฐม"
        ],
        bounding_box=(13.5, 99.0, 16.0, 101.5)
    ),
    
    "eastern": Region(
        name_en="Eastern Thailand",
        name_th="ภาคตะวันออก",
        aliases=[
            "east", "eastern", "eastern thailand", "east thailand",
            "ภาคตะวันออก", "ตะวันออก", "ทางตะวันออก"
        ],
        provinces=[
            "Chonburi", "Rayong", "Chanthaburi", "Trat", "Prachinburi",
            "Sa Kaeo", "Chachoengsao",
            # Thai names
            "ชลบุรี", "ระยอง", "จันทบุรี", "ตราด", "ปราจีนบุรี",
            "สระแก้ว", "ฉะเชิงเทรา"
        ],
        bounding_box=(12.0, 101.0, 14.5, 103.0)
    ),
    
    "western": Region(
        name_en="Western Thailand",
        name_th="ภาคตะวันตก",
        aliases=[
            "west", "western", "western thailand", "west thailand",
            "ภาคตะวันตก", "ตะวันตก", "ทางตะวันตก"
        ],
        provinces=[
            "Kanchanaburi", "Tak", "Ratchaburi", "Phetchaburi", "Prachuap Khiri Khan",
            # Thai names
            "กาญจนบุรี", "ตาก", "ราชบุรี", "เพชรบุรี", "ประจวบคีรีขันธ์"
        ],
        bounding_box=(12.5, 98.0, 17.5, 100.0)
    ),
    
    "southern": Region(
        name_en="Southern Thailand",
        name_th="ภาคใต้",
        aliases=[
            "south", "southern", "southern thailand", "south thailand",
            "ภาคใต้", "ใต้", "ทางใต้", "แถบใต้"
        ],
        provinces=[
            "Phuket", "Krabi", "Surat Thani", "Nakhon Si Thammarat", "Songkhla",
            "Hat Yai", "Trang", "Phang Nga", "Chumphon", "Ranong",
            "Satun", "Pattani", "Yala", "Narathiwat", "Phatthalung",
            # Thai names
            "ภูเก็ต", "กระบี่", "สุราษฎร์ธานี", "นครศรีธรรมราช", "สงขลา",
            "หาดใหญ่", "ตรัง", "พังงา", "ชุมพร", "ระนอง"
        ],
        bounding_box=(5.5, 98.0, 11.5, 102.5)
    ),
    
    # Special Bangkok Metropolitan Region
    "bma": Region(
        name_en="Bangkok Metropolitan Area",
        name_th="กรุงเทพและปริมณฑล",
        aliases=[
            "bma", "bangkok metropolitan", "greater bangkok", "bangkok area",
            "กรุงเทพและปริมณฑล", "ปริมณฑล", "กทม และ ปริมณฑล"
        ],
        provinces=[
            "Bangkok", "Nonthaburi", "Pathum Thani", "Samut Prakan",
            "Samut Sakhon", "Nakhon Pathom",
            # Thai names
            "กรุงเทพ", "นนทบุรี", "ปทุมธานี", "สมุทรปราการ", "สมุทรสาคร", "นครปฐม"
        ],
        bounding_box=(13.5, 100.2, 14.2, 100.9)
    ),
}


class RegionMatcher:
    """
    Match user queries to geographic regions
    """
    
    def __init__(self):
        self.regions = THAILAND_REGIONS
        self._build_index()
    
    def _build_index(self):
        """Build lookup index for fast alias matching"""
        self.alias_to_region: Dict[str, str] = {}
        
        for region_key, region in self.regions.items():
            # Add English name
            self.alias_to_region[region.name_en.lower()] = region_key
            # Add Thai name
            self.alias_to_region[region.name_th.lower()] = region_key
            # Add all aliases
            for alias in region.aliases:
                self.alias_to_region[alias.lower().strip()] = region_key
    
    def _normalize(self, text: str) -> str:
        """Normalize text for matching"""
        import re
        text = text.lower().strip()
        text = re.sub(r'[.,\-_\'\"()]', '', text)
        text = re.sub(r'\s+', ' ', text)
        return text
    
    def find_region(self, query: str) -> Optional[str]:
        """
        Find region key matching the query
        
        Args:
            query: User's search query (e.g., "Northern Thailand", "ภาคเหนือ")
            
        Returns:
            Region key (e.g., "northern") or None if not found
        """
        normalized = self._normalize(query)
        
        # Direct match
        if normalized in self.alias_to_region:
            return self.alias_to_region[normalized]
        
        # Check if any alias is contained in the query
        for alias, region_key in self.alias_to_region.items():
            if alias in normalized or normalized in alias:
                return region_key
        
        return None
    
    def get_region(self, region_key: str) -> Optional[Region]:
        """Get region by key"""
        return self.regions.get(region_key)
    
    def get_provinces_in_region(self, region_key: str) -> List[str]:
        """Get list of provinces in a region"""
        region = self.regions.get(region_key)
        if region:
            return region.provinces
        return []
    
    def get_bounding_box(self, region_key: str) -> Optional[Tuple[float, float, float, float]]:
        """Get geographic bounding box for a region"""
        region = self.regions.get(region_key)
        if region:
            return region.bounding_box
        return None
    
    def is_region_query(self, query: str) -> bool:
        """Check if query is referring to a region"""
        return self.find_region(query) is not None
    
    def get_search_terms_for_region(self, query: str) -> Tuple[Optional[str], List[str]]:
        """
        Get search terms for a region-based query
        
        Returns:
            Tuple of (region_key, list_of_province_search_terms)
        """
        region_key = self.find_region(query)
        
        if not region_key:
            return None, []
        
        region = self.regions[region_key]
        return region_key, region.provinces


# Global instance
_region_matcher: Optional[RegionMatcher] = None


def get_region_matcher() -> RegionMatcher:
    """Get global region matcher instance"""
    global _region_matcher
    if _region_matcher is None:
        _region_matcher = RegionMatcher()
    return _region_matcher


def match_region(query: str) -> Tuple[Optional[str], List[str]]:
    """
    Convenience function to match a region
    
    Returns:
        Tuple of (region_key, province_search_terms)
    """
    matcher = get_region_matcher()
    return matcher.get_search_terms_for_region(query)


def is_region_query(query: str) -> bool:
    """Check if query refers to a geographic region"""
    matcher = get_region_matcher()
    return matcher.is_region_query(query)
