from __future__ import annotations

import re
from datetime import datetime

import httpx
from pydantic import BaseModel

from app.config import settings


class RepositoryInfo(BaseModel):
    type: str  # 'github' or 'gitlab'
    owner: str
    name: str
    url: str


class RepositoryService:
    """Service for fetching repository data from GitHub and GitLab"""

    def __init__(self):
        self.github_token = getattr(settings, "GITHUB_TOKEN", None)
        self.gitlab_token = getattr(settings, "GITLAB_TOKEN", None)

    def parse_repository_url(self, url: str) -> RepositoryInfo | None:
        """Parse a GitHub or GitLab URL to extract repository information"""
        if not url:
            return None

        # GitHub patterns
        github_patterns = [
            r"https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$",
            r"git@github\.com:([^/]+)/([^/]+?)(?:\.git)?$",
        ]

        # GitLab patterns (including gitlab.com and self-hosted)
        gitlab_patterns = [
            r"https?://gitlab\.com/([^/]+)/([^/]+?)(?:\.git)?/?$",
            r"git@gitlab\.com:([^/]+)/([^/]+?)(?:\.git)?$",
            r"https?://([^/]+\.)+[^/]+/([^/]+)/([^/]+?)(?:\.git)?/?$",  # Self-hosted GitLab
        ]

        # Try GitHub patterns
        for pattern in github_patterns:
            match = re.match(pattern, url)
            if match:
                owner, name = match.groups()
                return RepositoryInfo(
                    type="github", owner=owner, name=name.replace(".git", ""), url=url
                )

        # Try GitLab patterns
        for pattern in gitlab_patterns:
            match = re.match(pattern, url)
            if match:
                groups = match.groups()
                if len(groups) == 2:  # gitlab.com pattern
                    owner, name = groups
                else:  # self-hosted pattern
                    owner, name = groups[1], groups[2]
                return RepositoryInfo(
                    type="gitlab", owner=owner, name=name.replace(".git", ""), url=url
                )

        return None

    async def fetch_readme(
        self, repo_info: RepositoryInfo
    ) -> tuple[str | None, datetime | None]:
        """Fetch README content from repository"""
        try:
            if repo_info.type == "github":
                return await self._fetch_github_readme(repo_info)
            if repo_info.type == "gitlab":
                return await self._fetch_gitlab_readme(repo_info)
            return None, None
        except Exception as e:
            print(f"Error fetching README from {repo_info.url}: {e}")
            return None, None

    async def _fetch_github_readme(
        self, repo_info: RepositoryInfo
    ) -> tuple[str | None, datetime | None]:
        """Fetch README from GitHub API"""
        headers = {}
        if self.github_token:
            headers["Authorization"] = f"token {self.github_token}"

        # Try different README filenames
        readme_files = ["README.md", "readme.md", "README.rst", "README.txt", "README"]

        async with httpx.AsyncClient(timeout=30.0) as client:
            for filename in readme_files:
                try:
                    # First get file info to get last modified date
                    info_url = f"https://api.github.com/repos/{repo_info.owner}/{repo_info.name}/contents/{filename}"
                    info_response = await client.get(info_url, headers=headers)

                    if info_response.status_code == 200:
                        # Get raw content - try master branch first
                        raw_url = f"https://raw.githubusercontent.com/{repo_info.owner}/{repo_info.name}/master/{filename}"
                        content_response = await client.get(raw_url)

                        # If master branch fails, try main branch
                        if content_response.status_code == 404:
                            raw_url = f"https://raw.githubusercontent.com/{repo_info.owner}/{repo_info.name}/main/{filename}"
                            content_response = await client.get(raw_url)

                        if content_response.status_code == 200:
                            # Try to get last commit date for this file
                            commits_url = f"https://api.github.com/repos/{repo_info.owner}/{repo_info.name}/commits"
                            # Use the branch that worked for content
                            branch = "master" if "master" in raw_url else "main"
                            commits_params = {
                                "path": filename,
                                "per_page": 1,
                                "sha": branch,
                            }
                            commits_response = await client.get(
                                commits_url, headers=headers, params=commits_params
                            )

                            last_updated = None
                            if commits_response.status_code == 200:
                                commits = commits_response.json()
                                if commits:
                                    commit_date = commits[0]["commit"]["committer"][
                                        "date"
                                    ]
                                    last_updated = datetime.fromisoformat(
                                        commit_date.replace("Z", "+00:00")
                                    )
                                    # Convert to timezone-naive datetime (UTC)
                                    last_updated = last_updated.replace(tzinfo=None)

                            return content_response.text, last_updated

                except httpx.HTTPStatusError:
                    continue

        return None, None

    async def _fetch_gitlab_readme(
        self, repo_info: RepositoryInfo
    ) -> tuple[str | None, datetime | None]:
        """Fetch README from GitLab API"""
        headers = {}
        if self.gitlab_token:
            headers["PRIVATE-TOKEN"] = self.gitlab_token

        # For gitlab.com
        if "gitlab.com" in repo_info.url:
            base_url = "https://gitlab.com/api/v4"
        else:
            # Extract base URL for self-hosted GitLab
            match = re.match(r"https?://([^/]+)", repo_info.url)
            if match:
                base_url = f"https://{match.group(1)}/api/v4"
            else:
                return None, None

        project_path = f"{repo_info.owner}/{repo_info.name}"
        encoded_path = project_path.replace("/", "%2F")

        # Try different README filenames
        readme_files = ["README.md", "readme.md", "README.rst", "README.txt", "README"]

        async with httpx.AsyncClient(timeout=30.0) as client:
            for filename in readme_files:
                try:
                    # Get file content
                    file_url = f"{base_url}/projects/{encoded_path}/repository/files/{filename}/raw"
                    file_params = {"ref": "main"}
                    file_response = await client.get(
                        file_url, headers=headers, params=file_params
                    )

                    if file_response.status_code == 200:
                        # Get last commit date for this file
                        commits_url = (
                            f"{base_url}/projects/{encoded_path}/repository/commits"
                        )
                        commits_params = {"path": filename, "per_page": 1}
                        commits_response = await client.get(
                            commits_url, headers=headers, params=commits_params
                        )

                        last_updated = None
                        if commits_response.status_code == 200:
                            commits = commits_response.json()
                            if commits:
                                commit_date = commits[0]["committed_date"]
                                last_updated = datetime.fromisoformat(
                                    commit_date.replace("Z", "+00:00")
                                )
                                # Convert to timezone-naive datetime (UTC)
                                last_updated = last_updated.replace(tzinfo=None)

                        return file_response.text, last_updated

                except httpx.HTTPStatusError:
                    # Try with 'master' branch
                    try:
                        file_params = {"ref": "master"}
                        file_response = await client.get(
                            file_url, headers=headers, params=file_params
                        )
                        if file_response.status_code == 200:
                            return file_response.text, None
                    except httpx.HTTPStatusError:
                        continue

        return None, None

    async def validate_repository(self, repo_info: RepositoryInfo) -> bool:
        """Validate that a repository exists and is accessible"""
        try:
            if repo_info.type == "github":
                return await self._validate_github_repo(repo_info)
            if repo_info.type == "gitlab":
                return await self._validate_gitlab_repo(repo_info)
            return False
        except Exception:
            return False

    async def _validate_github_repo(self, repo_info: RepositoryInfo) -> bool:
        """Validate GitHub repository exists"""
        headers = {}
        if self.github_token:
            headers["Authorization"] = f"token {self.github_token}"

        url = f"https://api.github.com/repos/{repo_info.owner}/{repo_info.name}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(url, headers=headers)
                return response.status_code == 200
            except httpx.HTTPStatusError:
                return False

    async def _validate_gitlab_repo(self, repo_info: RepositoryInfo) -> bool:
        """Validate GitLab repository exists"""
        headers = {}
        if self.gitlab_token:
            headers["PRIVATE-TOKEN"] = self.gitlab_token

        # For gitlab.com
        if "gitlab.com" in repo_info.url:
            base_url = "https://gitlab.com/api/v4"
        else:
            # Extract base URL for self-hosted GitLab
            match = re.match(r"https?://([^/]+)", repo_info.url)
            if match:
                base_url = f"https://{match.group(1)}/api/v4"
            else:
                return False

        project_path = f"{repo_info.owner}/{repo_info.name}"
        encoded_path = project_path.replace("/", "%2F")
        url = f"{base_url}/projects/{encoded_path}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(url, headers=headers)
                return response.status_code == 200
            except httpx.HTTPStatusError:
                return False


# Global instance
repository_service = RepositoryService()
