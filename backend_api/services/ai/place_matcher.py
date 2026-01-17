"""
Place Name Matcher with Phonetic Support

Provides flexible place name matching including:
- Customizable aliases (Thai/English/phonetic variations)
- Phonetic matching using transliteration rules
- Fuzzy string matching
- Common misspelling handling
"""

import re
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass
from backend_model.logger import logger


@dataclass
class PlaceAlias:
    """Represents a place with all its known aliases"""
    canonical_name: str  # Primary name for matching
    aliases: Set[str]    # All known variations


# =============================================================================
# CUSTOMIZABLE PLACE NAME ALIASES
# Add new entries here to support additional place names and variations
# =============================================================================

PLACE_ALIASES: Dict[str, List[str]] = {
    # Bangkok and variations
    "Bangkok": [
        "bangkok", "กรุงเทพ", "กรุงเทพมหานคร", "กทม", "krung thep", "krungthep",
        "bkk", "bangkork", "bankok", "bangok", "กรุงเทพฯ"
    ],
    
    # Chiang Mai and variations
    "Chiang Mai": [
        "chiang mai", "chiangmai", "เชียงใหม่", "เชียงใหม", "chiang-mai",
        "changmai", "chiengmai", "chiangmai", "chmai", "cnx", "เมืองเชียงใหม่"
    ],
    
    # Chiang Rai and variations
    "Chiang Rai": [
        "chiang rai", "chiangrai", "เชียงราย", "chiang-rai", "changrai",
        "chiengrai", "crai", "เมืองเชียงราย"
    ],
    
    # Khon Kaen and variations
    "Khon Kaen": [
        "khon kaen", "khonkaen", "ขอนแก่น", "kon kaen", "konkaen",
        "khonkean", "kk", "เมืองขอนแก่น"
    ],
    
    # Phuket and variations
    "Phuket": [
        "phuket", "ภูเก็ต", "puket", "phooket", "phucket", "hkt"
    ],
    
    # Nakhon Ratchasima (Korat) and variations
    "Nakhon Ratchasima": [
        "nakhon ratchasima", "nakhonratchasima", "นครราชสีมา", "korat", "โคราช",
        "khorat", "nakhon", "เมืองนครราชสีมา"
    ],
    
    # Udon Thani and variations
    "Udon Thani": [
        "udon thani", "udonthani", "อุดรธานี", "udon", "อุดร", "uth"
    ],
    
    # Hat Yai and variations
    "Hat Yai": [
        "hat yai", "hatyai", "หาดใหญ่", "hadyai", "haad yai", "hy"
    ],
    
    # Lampang and variations
    "Lampang": [
        "lampang", "ลำปาง", "lampang", "lumpang", "lp"
    ],
    
    # Lamphun and variations
    "Lamphun": [
        "lamphun", "ลำพูน", "lumphun", "lampoon"
    ],
    
    # Mae Hong Son and variations
    "Mae Hong Son": [
        "mae hong son", "maehongson", "แม่ฮ่องสอน", "mae-hong-son", "mhs"
    ],
    
    # Nan and variations
    "Nan": [
        "nan", "น่าน", "จ.น่าน"
    ],
    
    # Phrae and variations
    "Phrae": [
        "phrae", "แพร่", "prae", "phare"
    ],
    
    # Tak and variations
    "Tak": [
        "tak", "ตาก", "จ.ตาก"
    ],
    
    # Sukhothai and variations
    "Sukhothai": [
        "sukhothai", "สุโขทัย", "sukkhothai", "sukothai"
    ],
    
    # Phitsanulok and variations
    "Phitsanulok": [
        "phitsanulok", "พิษณุโลก", "pitsanulok", "phisanulok", "psl"
    ],
    
    # Rayong and variations
    "Rayong": [
        "rayong", "ระยอง", "rayoung", "raeyong"
    ],
    
    # Samut Prakan and variations
    "Samut Prakan": [
        "samut prakan", "samutprakan", "สมุทรปราการ", "samutprakarn",
        "samut prakarn", "ปากน้ำ"
    ],
    
    # Pathum Thani and variations
    "Pathum Thani": [
        "pathum thani", "pathumthani", "ปทุมธานี", "pathum", "patoomtani"
    ],
    
    # Nonthaburi and variations
    "Nonthaburi": [
        "nonthaburi", "นนทบุรี", "nontaburi", "nontha"
    ],
    
    # Saraburi and variations
    "Saraburi": [
        "saraburi", "สระบุรี", "sarabure"
    ],
}


# =============================================================================
# THAI-ENGLISH PHONETIC TRANSLITERATION RULES
# Used for approximate matching when exact matches fail
# =============================================================================

THAI_TO_PHONETIC: Dict[str, List[str]] = {
    # Vowels
    "า": ["a", "aa"],
    "ิ": ["i"],
    "ี": ["i", "ee"],
    "ุ": ["u"],
    "ู": ["u", "oo"],
    "เ": ["e", "ay"],
    "แ": ["ae", "a"],
    "โ": ["o", "oh"],
    "ใ": ["ai", "i"],
    "ไ": ["ai", "i"],
    "อ": ["o", "or"],
    "ั": ["a"],
    "็": [""],
    "ะ": ["a"],
    "ำ": ["am"],
    "ึ": ["eu", "u"],
    "ื": ["eu", "u"],
    
    # Consonants
    "ก": ["k", "g"],
    "ข": ["kh", "k"],
    "ค": ["kh", "k"],
    "ฆ": ["kh", "k"],
    "ง": ["ng"],
    "จ": ["j", "ch"],
    "ฉ": ["ch"],
    "ช": ["ch"],
    "ซ": ["s", "z"],
    "ฌ": ["ch"],
    "ญ": ["y", "n"],
    "ฎ": ["d"],
    "ฏ": ["t", "d"],
    "ฐ": ["th", "t"],
    "ฑ": ["th", "t"],
    "ฒ": ["th", "t"],
    "ณ": ["n"],
    "ด": ["d"],
    "ต": ["t", "d"],
    "ถ": ["th", "t"],
    "ท": ["th", "t"],
    "ธ": ["th", "t"],
    "น": ["n"],
    "บ": ["b"],
    "ป": ["p", "b"],
    "ผ": ["ph", "p"],
    "ฝ": ["f"],
    "พ": ["ph", "p"],
    "ฟ": ["f"],
    "ภ": ["ph", "p"],
    "ม": ["m"],
    "ย": ["y"],
    "ร": ["r", "l"],
    "ฤ": ["ri", "reu"],
    "ล": ["l", "r"],
    "ว": ["w", "v"],
    "ศ": ["s"],
    "ษ": ["s"],
    "ส": ["s"],
    "ห": ["h"],
    "ฬ": ["l"],
    "อ": ["", "o"],
    "ฮ": ["h"],
    
    # Special characters
    "ๆ": [""],
    "่": [""],  # Tone marks
    "้": [""],
    "๊": [""],
    "๋": [""],
    "์": [""],
    "ฯ": [""],
}

# English phonetic variations for common sounds
ENGLISH_PHONETIC_VARIANTS: Dict[str, List[str]] = {
    "ch": ["j", "sh", "tch"],
    "ph": ["f", "p"],
    "th": ["t", "d"],
    "ai": ["i", "ay", "ei"],
    "ae": ["a", "e", "ai"],
    "ee": ["i", "ea"],
    "oo": ["u", "ou"],
    "ng": ["n"],
    "kh": ["k", "c"],
}

# =============================================================================
# THAI HOMOPHONES - Words that sound the same but spelled differently
# These are common in Thai where similar-sounding consonants/vowels exist
# =============================================================================
THAI_HOMOPHONES: Dict[str, List[str]] = {
    # ค/ข/ฆ - same 'kh' sound
    "ข": ["ค", "ฆ"],
    "ค": ["ข", "ฆ"],
    "ฆ": ["ข", "ค"],
    
    # ส/ศ/ษ - same 's' sound
    "ส": ["ศ", "ษ"],
    "ศ": ["ส", "ษ"],
    "ษ": ["ส", "ศ"],
    
    # ท/ธ/ฑ/ฒ/ถ - same 'th' sound
    "ท": ["ธ", "ฑ", "ฒ", "ถ"],
    "ธ": ["ท", "ฑ", "ฒ", "ถ"],
    "ถ": ["ท", "ธ", "ฑ", "ฒ"],
    
    # พ/ภ/ผ - same 'ph' sound
    "พ": ["ภ", "ผ"],
    "ภ": ["พ", "ผ"],
    "ผ": ["พ", "ภ"],
    
    # น/ณ - same 'n' sound
    "น": ["ณ"],
    "ณ": ["น"],
    
    # ล/ฬ - same 'l' sound
    "ล": ["ฬ"],
    "ฬ": ["ล"],
    
    # ช/ฉ/ฌ - same 'ch' sound
    "ช": ["ฉ", "ฌ"],
    "ฉ": ["ช", "ฌ"],
    
    # ญ/ย - similar sounds
    "ญ": ["ย"],
    "ย": ["ญ"],
    
    # ร/ล - often confused in Thai
    "ร": ["ล"],
    "ล": ["ร"],
    
    # ใ/ไ - same 'ai' vowel sound
    "ใ": ["ไ"],
    "ไ": ["ใ"],
}

# Common Thai word homophones/misspellings for place names
THAI_WORD_HOMOPHONES: Dict[str, List[str]] = {
    # เชียง variations (commonly misspelled)
    "เชียง": ["เจียง", "เเชียง"],
    
    # ใหม่/ไหม่ - common vowel confusion
    "ใหม่": ["ไหม่", "หม่าย", "ใหม"],
    
    # ราย/ไร
    "ราย": ["ไร", "ลาย"],
    
    # กรุงเทพ variations
    "กรุงเทพ": ["กรุงเทป", "กุงเทพ", "กรุ้งเทพ", "กรุงเทพฯ"],
    
    # ขอนแก่น variations
    "ขอนแก่น": ["คอนแก่น", "ขอนเเก่น", "ขอนแกน"],
    
    # ภูเก็ต variations
    "ภูเก็ต": ["พูเก็ต", "ปูเก็ต", "ภูเก็ด", "ภูเกต"],
    
    # อุดร variations
    "อุดร": ["อุดอน", "อุดอร", "อุดรณ"],
    
    # นครราชสีมา variations
    "นครราชสีมา": ["นคอราชสีมา", "นครราดสีมา", "โคราช", "โคราด"],
    "โคราช": ["โคราด", "โครราช"],
    
    # ลำปาง variations
    "ลำปาง": ["ลำป่าง", "ลำปัง", "ลัมปาง"],
    
    # ลำพูน variations
    "ลำพูน": ["ลำพุน", "ลัมพูน"],
    
    # สระบุรี variations
    "สระบุรี": ["สระบุลี", "สลาบุรี"],
    
    # ปทุมธานี variations
    "ปทุมธานี": ["ปทุมทานี", "ประทุมธานี"],
    
    # ระยอง variations
    "ระยอง": ["ลายอง", "ระยอน", "รายอง"],
    
    # สมุทรปราการ variations
    "สมุทรปราการ": ["สมุดปราการ", "สมุทปราการ"],
    
    # แม่ฮ่องสอน variations  
    "แม่ฮ่องสอน": ["แม่ฮองสอน", "แมฮ่องสอน", "แม้ฮ่องสอน"],
    
    # หาดใหญ่ variations
    "หาดใหญ่": ["หาดไหญ่", "หาดหญ่", "หาดใหย่"],
    
    # น่าน variations
    "น่าน": ["นาน", "น้าน"],
    
    # แพร่ variations
    "แพร่": ["แพร", "แพ่ร"],
    
    # พิษณุโลก variations
    "พิษณุโลก": ["พิศณุโลก", "พิสณุโลก", "พิษโลก"],
}


class PlaceNameMatcher:
    """
    Flexible place name matcher with phonetic support
    """
    
    def __init__(self, custom_aliases: Optional[Dict[str, List[str]]] = None):
        """
        Initialize matcher with place aliases
        
        Args:
            custom_aliases: Optional custom aliases to merge with defaults
        """
        self.aliases = PLACE_ALIASES.copy()
        if custom_aliases:
            self._merge_aliases(custom_aliases)
        
        # Build reverse lookup index
        self._build_index()
    
    def _merge_aliases(self, custom_aliases: Dict[str, List[str]]):
        """Merge custom aliases with existing ones"""
        for canonical, aliases in custom_aliases.items():
            if canonical in self.aliases:
                self.aliases[canonical].extend(aliases)
            else:
                self.aliases[canonical] = aliases
    
    def _build_index(self):
        """Build reverse lookup index from alias to canonical name"""
        self.alias_to_canonical: Dict[str, str] = {}
        
        for canonical, aliases in self.aliases.items():
            # Normalize canonical name
            normalized_canonical = self._normalize(canonical)
            self.alias_to_canonical[normalized_canonical] = canonical
            
            # Add all aliases
            for alias in aliases:
                normalized_alias = self._normalize(alias)
                self.alias_to_canonical[normalized_alias] = canonical
    
    def _normalize(self, text: str) -> str:
        """Normalize text for matching"""
        # Lowercase
        text = text.lower().strip()
        # Remove common punctuation
        text = re.sub(r'[.,\-_\'\"()]', '', text)
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text)
        return text
    
    def _thai_to_phonetic(self, thai_text: str) -> List[str]:
        """
        Convert Thai text to possible phonetic spellings
        
        Returns multiple possibilities due to ambiguous transliteration
        """
        results = [""]
        
        for char in thai_text:
            if char in THAI_TO_PHONETIC:
                variants = THAI_TO_PHONETIC[char]
                if variants:
                    # Expand results with all variants
                    new_results = []
                    for result in results:
                        for variant in variants:
                            new_results.append(result + variant)
                    results = new_results[:50]  # Limit to prevent explosion
            elif char.isascii():
                results = [r + char for r in results]
            # Skip unknown Thai characters
        
        return results
    
    def _generate_phonetic_variants(self, text: str) -> List[str]:
        """Generate phonetic variants of English text"""
        variants = [text]
        
        for pattern, replacements in ENGLISH_PHONETIC_VARIANTS.items():
            new_variants = []
            for variant in variants:
                if pattern in variant:
                    for replacement in replacements:
                        new_variants.append(variant.replace(pattern, replacement))
            variants.extend(new_variants)
        
        # Also try without spaces
        variants.extend([v.replace(" ", "") for v in variants])
        
        return list(set(variants))[:20]  # Limit and dedupe
    
    def _generate_homophone_variants(self, thai_text: str) -> List[str]:
        """
        Generate Thai homophone variants for place names
        
        Handles common Thai spelling variations where characters
        sound the same but are written differently.
        """
        variants = [thai_text]
        
        # Check for word-level homophones first
        for word, homophone_list in THAI_WORD_HOMOPHONES.items():
            if word in thai_text:
                for homophone in homophone_list:
                    variants.append(thai_text.replace(word, homophone))
        
        # Also add reverse mapping (from homophone to original)
        for word, homophone_list in THAI_WORD_HOMOPHONES.items():
            for homophone in homophone_list:
                if homophone in thai_text:
                    variants.append(thai_text.replace(homophone, word))
        
        # Generate character-level homophone variants (limit to prevent explosion)
        char_variants = [thai_text]
        for i, char in enumerate(thai_text):
            if char in THAI_HOMOPHONES and len(char_variants) < 30:
                new_variants = []
                for variant in char_variants[:10]:  # Limit base variants
                    for homophone in THAI_HOMOPHONES[char]:
                        new_variant = variant[:i] + homophone + variant[i+1:]
                        if new_variant not in new_variants and new_variant != variant:
                            new_variants.append(new_variant)
                char_variants.extend(new_variants)
        
        variants.extend(char_variants)
        
        # Remove duplicates
        return list(set(variants))[:30]
    
    def find_canonical_name(self, query: str) -> Optional[str]:
        """
        Find canonical place name for a query
        
        Args:
            query: User's search query
            
        Returns:
            Canonical place name or None if not found
        """
        normalized = self._normalize(query)
        
        # Try exact match first
        if normalized in self.alias_to_canonical:
            return self.alias_to_canonical[normalized]
        
        # Try without spaces
        no_spaces = normalized.replace(" ", "")
        if no_spaces in self.alias_to_canonical:
            return self.alias_to_canonical[no_spaces]
        
        # Try phonetic variants
        variants = self._generate_phonetic_variants(normalized)
        for variant in variants:
            if variant in self.alias_to_canonical:
                return self.alias_to_canonical[variant]
        
        # Try Thai to phonetic conversion if contains Thai
        if any('\u0e00' <= c <= '\u0e7f' for c in query):
            phonetic_versions = self._thai_to_phonetic(query)
            for phonetic in phonetic_versions:
                phonetic_normalized = self._normalize(phonetic)
                if phonetic_normalized in self.alias_to_canonical:
                    return self.alias_to_canonical[phonetic_normalized]
        
        return None
    
    def get_search_terms(self, query: str) -> List[str]:
        """
        Get all possible search terms for a query
        
        Returns list of terms to try searching in database
        """
        terms = [query]
        normalized = self._normalize(query)
        
        # Add normalized version
        if normalized != query.lower():
            terms.append(normalized)
        
        # Add canonical name if found
        canonical = self.find_canonical_name(query)
        if canonical:
            terms.append(canonical)
            # Add all aliases for the canonical name
            terms.extend(self.aliases.get(canonical, []))
        
        # Add phonetic variants
        terms.extend(self._generate_phonetic_variants(normalized))
        
        # Add Thai phonetic versions and homophones
        if any('\u0e00' <= c <= '\u0e7f' for c in query):
            terms.extend(self._thai_to_phonetic(query)[:10])
            # Add homophone variants for Thai text
            terms.extend(self._generate_homophone_variants(query))
        
        # Remove duplicates and empty strings
        seen = set()
        unique_terms = []
        for term in terms:
            term_lower = term.lower().strip()
            if term_lower and term_lower not in seen:
                seen.add(term_lower)
                unique_terms.append(term)
        
        return unique_terms[:50]  # Increased limit for homophones
    
    def get_all_aliases(self, place_name: str) -> List[str]:
        """Get all known aliases for a place"""
        # First try to find canonical name
        canonical = self.find_canonical_name(place_name)
        if canonical:
            return [canonical] + self.aliases.get(canonical, [])
        
        # Otherwise return just the input
        return [place_name]
    
    def add_alias(self, canonical_name: str, aliases: List[str]):
        """
        Add new aliases for a place (for runtime customization)
        
        Args:
            canonical_name: The main/primary name for the place
            aliases: List of alternative names/spellings
        """
        if canonical_name in self.aliases:
            self.aliases[canonical_name].extend(aliases)
        else:
            self.aliases[canonical_name] = aliases
        
        # Rebuild index
        self._build_index()
        logger.info(f"Added {len(aliases)} aliases for '{canonical_name}'")


# Global instance
_place_matcher: Optional[PlaceNameMatcher] = None


def get_place_matcher() -> PlaceNameMatcher:
    """Get global place name matcher instance"""
    global _place_matcher
    if _place_matcher is None:
        _place_matcher = PlaceNameMatcher()
    return _place_matcher


def match_place_name(query: str) -> Tuple[Optional[str], List[str]]:
    """
    Convenience function to match a place name
    
    Returns:
        Tuple of (canonical_name, search_terms)
    """
    matcher = get_place_matcher()
    canonical = matcher.find_canonical_name(query)
    search_terms = matcher.get_search_terms(query)
    return canonical, search_terms
