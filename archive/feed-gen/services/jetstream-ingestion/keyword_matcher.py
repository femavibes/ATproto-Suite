"""Aho-Corasick keyword matcher for filtering posts."""

import ahocorasick
from pathlib import Path
from typing import Set
from config import KEYWORDS_FILE


class KeywordMatcher:
    """Fast keyword matching using Aho-Corasick algorithm."""
    
    def __init__(self):
        self.automaton = None
        self.keywords: Set[str] = set()
        self._load_keywords()
        self._build_automaton()
    
    def _load_keywords(self) -> None:
        """Load keywords from file."""
        keywords_path = Path(KEYWORDS_FILE)
        
        if not keywords_path.exists():
            print(f"Warning: Keywords file not found: {KEYWORDS_FILE}")
            print("Using empty keyword set (no posts will match)")
            return
        
        with open(keywords_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                # Skip empty lines and comments
                if line and not line.startswith('#'):
                    # Convert to lowercase for case-insensitive matching
                    self.keywords.add(line.lower())
        
        print(f"Loaded {len(self.keywords)} keywords from {KEYWORDS_FILE}")
    
    def _build_automaton(self) -> None:
        """Build Aho-Corasick automaton from keywords."""
        self.automaton = ahocorasick.Automaton()
        
        for keyword in self.keywords:
            self.automaton.add_word(keyword, keyword)
        
        self.automaton.make_automaton()
        print(f"Built Aho-Corasick automaton with {len(self.keywords)} keywords")
    
    def match(self, text: str) -> bool:
        """
        Check if text contains any keywords.
        Returns True if any keyword is found, False otherwise.
        """
        if not self.automaton or not text:
            return False
        
        # Convert to lowercase for case-insensitive matching
        text_lower = text.lower()
        
        # Check for matches
        for end_index, keyword in self.automaton.iter(text_lower):
            return True  # Found at least one match
        
        return False
    
    def reload(self) -> None:
        """Reload keywords and rebuild automaton (for hot-reloading)."""
        self.keywords.clear()
        self._load_keywords()
        self._build_automaton()

    def merge_keywords(self, extra_keywords: Set[str]) -> None:
        """Merge additional keywords (e.g. from DB hints) and rebuild automaton."""
        for keyword in extra_keywords or set():
            k = str(keyword or "").strip().lower()
            if k:
                self.keywords.add(k)
        self._build_automaton()
