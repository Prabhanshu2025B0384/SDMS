from app.core.security import verify_password
import bcrypt

hash_val = "$2b$12$rdQZ6jGbwRQUIAncVFfFMOIK/NfVoxMuewdTzfli7Nwk28ykZE11q"
is_valid = verify_password("admin", hash_val)
print(f"Is valid? {is_valid}")
