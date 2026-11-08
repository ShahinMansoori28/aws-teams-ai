# Step 0: Tools on your laptop

What got installed, why, and the exact command. All installs use **winget**, the Windows package manager (like an app store you drive from the terminal).

| Tool | Why we need it | Command |
|---|---|---|
| AWS CLI v2 | Talk to AWS (or Floci) from the terminal: `aws s3 ls`, `aws dynamodb scan` | `winget install --id Amazon.AWSCLI -e` |
| GitHub CLI (`gh`) | Create the GitHub repo and push from the terminal | `winget install --id GitHub.cli -e` |
| Docker Desktop | Runs containers. Floci (fake AWS) runs in one, and each Lambda runs in its own | `winget install --id Docker.DockerDesktop -e` |
| Node.js 24 | Already installed. Runs CDK, the Next.js app and the scripts | (already there) |
| Git | Already installed. Version history | (already there) |
| WSL2 + Ubuntu | Already installed. A real Linux kernel inside Windows; Docker Desktop runs on it | (already there) |

Flags: `--id ... -e` means "exactly this package", and `--silent` means "no installer wizard". Windows still shows a **UAC popup** ("allow changes?") because installing software needs admin rights.

## Check it worked

Open a **new** terminal (so it picks up the new PATH), then:

```powershell
aws --version        # aws-cli/2.x
gh --version         # gh version 2.x
docker --version     # Docker version 2x.x
docker run hello-world
```

## Words you'll see

- **Container**: a small, isolated box running one program with everything it needs. Think lightweight VM.
- **Image**: the recipe for a container (`floci/floci:2.4.0`). `docker run` turns an image into a running container.
- **docker-compose**: a YAML file that says "run these containers with these settings". We use it to start Floci.
- **PATH**: the list of folders Windows searches when you type a command. Installers add to it, so open a new terminal after installing.
