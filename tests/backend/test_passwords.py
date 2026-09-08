from backend.auth.passwords import hash_password, verify_password


def test_hash_and_verify():
    h = hash_password("secret-pass")
    assert h != "secret-pass"
    assert verify_password("secret-pass", h)
    assert not verify_password("wrong", h)
