import os
import tomllib

data = tomllib.load(open("pyproject.toml", "rb"))
deps = [d for d in data["project"].get("dependencies", []) if "photography-portfolio" not in d]
if os.environ.get("BUILD_TYPE") == "development":
    deps += [
        d
        for d in data["project"].get("optional-dependencies", {}).get("test", [])
        if "photography-portfolio" not in d
    ]
open("/tmp/requirements.txt", "w").write("\n".join(deps))
