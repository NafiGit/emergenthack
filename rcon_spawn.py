#!/usr/bin/env python3
from mcrcon import MCRcon

with MCRcon("localhost", "minecraft123", port=25575) as mcr:
    resp = mcr.command("summon zombie_horse -142 68 165")
    print(f"Response: {resp}")
