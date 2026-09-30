#!/usr/bin/env bash
cd "$(dirname "$0")/backend" || exit 1
exec ./venv/bin/python start_backend.py
