import os
import base64
import unittest
from datetime import datetime, timedelta

# 1x1 transparent PNG base64
TINY_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

class TestSupportAttachments(unittest.TestCase):
    def test_base64_decode_and_size(self):
        raw = base64.b64decode(TINY_PNG_B64)
        self.assertTrue(len(raw) > 0)
        self.assertTrue(len(raw) <= 5 * 1024 * 1024)
        self.assertTrue(raw.startswith(b"\x89PNG"))

    def test_retention_days_calculation(self):
        resolved_at = datetime.utcnow() - timedelta(days=2)
        elapsed = (datetime.utcnow() - resolved_at).total_seconds()
        rem_sec = (8 * 86400) - elapsed
        days_left = max(0, int(rem_sec // 86400))
        self.assertEqual(days_left, 5)

        # Expired after 8+ days
        resolved_at_expired = datetime.utcnow() - timedelta(days=8, hours=2)
        elapsed_exp = (datetime.utcnow() - resolved_at_expired).total_seconds()
        rem_sec_exp = (8 * 86400) - elapsed_exp
        self.assertTrue(rem_sec_exp <= 0)

if __name__ == '__main__':
    unittest.main()
