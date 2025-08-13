## **Git Branching and Release Process**

### 1\. Objective

This document outlines our team's standardized Git workflow. The primary goals of this process are:

- To maintain a stable production environment.
- To provide a clear, predictable process for planned releases.
- To enable safe and urgent fixes to production code without deploying unstable features.

### 2\. Core Principles

- **`main` is for integration, not deployment.** The `main` branch contains the latest developments and represents our "next release." It is not considered stable at all times.
- **Production deploys are triggered _only_ by tags.** The CI/CD production pipeline is configured to run exclusively when a new version tag (e.g., `v1.5.1`) is pushed.
- **Versioning is key.** We use Semantic Versioning (e.g., `vMAJOR.MINOR.PATCH`).
- **Code review is mandatory.** All changes must be reviewed and approved via a Pull Request (PR).

### 3\. Branching Strategy

#### Main (`main`)

This is our primary, long-lived branch. All new feature development is ultimately merged into `main`. The `HEAD` of `main` reflects the state of the upcoming release.

#### Hotfixes (`hotfix/vX.Y.Z`)

- **Purpose**: To serve as a stable base for an urgent production fix. It isolates the fix from the `main` branch.
- **Branched from**: A production version tag (e.g., `v1.5.0`).
- **Merged to**: `main` (after the fix is deployed).
- **Example**: `hotfix/v1.5.1`

#### Development (`ED-****-short-descriptor`)

- **Purpose**: For developing new features or bug fixes.
- **Branched from**: `main` or `hotfix/vX.Y.Z`
- **Merged to**: `main` or `hotfix/vX.Y.Z`
- **Format**: Jira tiket id plus a short description
- **Examples**: `ED-1234-my-new-feature` , `ED-5678-fix-login`

> Aside from the main branch, the other formats are suggested naming conventions. There's no rule or process to enforce their use.

### 4\. Workflows

#### A. New Feature Development

This is the standard day-to-day workflow for adding new functionality.

1.  Create a new branch from `main`:
    ```bash
    git checkout main
    git pull
    git checkout -b ED-1234-my-new-feature
    ```
2.  Develop the feature and commit your changes.
3.  Open a Pull Request from `ED-1234-my-new-feature` to `main`.
4.  After the PR is reviewed and approved, merge it into `main`.

#### B. Planned Release

This flow is used when we decide that the features currently in `main` are ready for a production release.

1.  Ensure the `main` branch is stable and has all the features intended for the new release.
2.  Create a new version tag on the `HEAD` of the `main` branch:
    ```bash
    git checkout main
    git pull
    git tag -a v1.6.0 -m "Release version 1.6.0 with new user profile"
    ```
3.  Push the tag to the remote repository. This will trigger the CI/CD pipeline to deploy the new version.
    ```bash
    git push origin v1.6.0
    ```

#### C. Hotfix (Urgent Production Fix)

This is the critical workflow for fixing a bug in the live production version. It is designed to be safe and isolated from `main`.

**Scenario**: A critical bug is found in production version `v1.5.0`.

1.  **Create a Hotfix Base Branch**: Create a new base branch from the exact production version tag. This step is necessary so we can create a pull request on GitHub later.

    ```bash
    git checkout -b hotfix/v1.5.1 v1.5.0
    ```

2.  **Create a Working Branch**: Branch from the new hotfix base to perform the actual coding.

    ```bash
    git checkout -b ED-5678-fix-login hotfix/v1.5.1
    ```

3.  **Implement the Fix**: Make the necessary code changes and commits on the `ED-5678-fix-login` branch.

4.  **Open PR \#1 (Validation)**: Open a Pull Request to merge the fix into the hotfix base branch. This allows for code review of the fix in a completely isolated environment.
    - **From**: `ED-5678-fix-login`
    - **To**: `hotfix/v1.5.1`

5.  **Merge PR \#1**: After approval, merge the PR. The `hotfix/v1.5.1` branch now contains the production code plus the validated fix.

6.  **Tag and Deploy**: Create a new tag on the `HEAD` of the `hotfix/v1.5.1` branch.

    ```bash
    git checkout hotfix/v1.5.1
    git tag -a v1.5.1 -m "Hotfix for critical login issue"
    ```

    Push the new tag to trigger the production deployment.

    ```bash
    git push origin v1.5.1
    ```

7.  **Open PR \#2 (Sync with `main`)**: Finally, ensure the fix is not lost in future releases by merging the hotfix branch back into `main`.
    - **From**: `hotfix/v1.5.1`
    - **To**: `main`
    - This PR will integrate the fix with the new features already on `main`. Resolve any potential merge conflicts here.

### 5\. Visual Summary

```
      (feature) D---E---F
     /                   \
A---B---C-----------------G---H--- (main)
    ^ \                   /
    |  `----I---J--------'  (hotfix/v1.5.1)
    |       ^   |
    |       |   (Tag v1.5.1 DEPLOY)
    |       |
    |       `-- (feature/fix)
    |
(Tag v1.5.0 on commit B)
```
