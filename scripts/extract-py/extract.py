#!/usr/bin/env python3
"""Extract the ``sukko`` (Python SDK) reference with griffe.

griffe statically analyses the source (no import, so sukko-py's deps are NOT required), resolves the
``__init__`` re-export aliases to their real definitions, and reports the public ``__all__`` surface.
Output matches the schema ``scripts/generate-docs.js`` consumes:

    {"packages": [{"name": "sukko", "dir": ..., "exports": [{"name","kind","signature"}]}]}

``kind`` is one of: function | type | class | constant. Usage: ``python extract.py /path/to/sukko-py``.
"""

import json
import sys
from pathlib import Path

import griffe


def _ann(node):
    return str(node) if node is not None else None


def _kind(name, obj):
    k = obj.kind.value if hasattr(obj.kind, "value") else str(obj.kind)
    if k == "class":
        return "class"
    if k == "function":
        return "function"
    if k == "attribute":
        # UPPER_SNAKE and dunder (e.g. __version__) → a constant; CamelCase attribute → a type alias
        # (e.g. Platform, OverflowPolicy).
        return "constant" if (name.isupper() or name.startswith("__")) else "type"
    return None


def _signature(name, kind, obj):
    if kind != "function":
        return name
    params = []
    for p in getattr(obj, "parameters", []):
        if p.name in ("self", "cls"):
            continue
        ann = _ann(getattr(p, "annotation", None))
        params.append(f"{p.name}: {ann}" if ann else p.name)
    ret = _ann(getattr(obj, "returns", None))
    return f"{name}({', '.join(params)})" + (f" -> {ret}" if ret else "")


def main():
    if len(sys.argv) < 2:
        print("Usage: extract.py /path/to/sukko-py", file=sys.stderr)
        sys.exit(1)
    src = Path(sys.argv[1]) / "src"
    sukko = griffe.load("sukko", search_paths=[str(src)], resolve_aliases=True)

    all_names = list(sukko.exports or [])  # __all__ — the declared public surface
    exports = []
    emitted = set()
    for name in all_names:
        member = sukko.members.get(name)
        if member is None:
            continue
        try:
            obj = member.final_target if member.is_alias else member
        except Exception:
            obj = member
        kind = _kind(name, obj)
        if kind is None:
            continue
        exports.append({"name": name, "kind": kind, "signature": _signature(name, kind, obj)})
        emitted.add(name)

    # Fail loudly if any declared public name did not resolve. The usual cause is an accidental
    # PEP 420 namespace package (a subdirectory missing __init__.py) that griffe silently skips —
    # exactly the class of bug that once dropped the transport exports. A silent 34-of-39 reference
    # would green-build a wrong docs page; a non-zero exit reds the build (extract.sh is pipefail).
    missing = [n for n in all_names if n not in emitted]
    if missing:
        print(
            f"ERROR: {len(missing)} of {len(all_names)} names in sukko.__all__ did not resolve to a "
            f"documented export: {missing}. Likely an accidental PEP 420 namespace package "
            f"(a package directory missing __init__.py, which griffe skips).",
            file=sys.stderr,
        )
        sys.exit(1)

    exports.sort(key=lambda e: e["name"])
    if not exports:
        print("WARNING: sukko produced 0 exports — is sukko-py's src/ present?", file=sys.stderr)

    print(json.dumps({"packages": [{"name": "sukko", "dir": "src/sukko", "exports": exports}]}, indent=2))


if __name__ == "__main__":
    main()
