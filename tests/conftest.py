import os
import pytest

# Ensure all tests run with isolated SQLite async test database
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///data/clauseguard_test.db"
