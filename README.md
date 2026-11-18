# DevOps Pipeline Success Indicator — Pipeline Pulse v1.4

A small Cloud Computing project that displays the latest AWS CodePipeline result as a virtual LED strip on a simple web dashboard. The ESP32 and RGB LED are represented in software, so no physical hardware is required for the class demo.

## Version 1.4

The dashboard now includes an execution trend panel, a dynamic success-rate ring, pass/fail/running counts, a filterable execution log, and an improved operations layout. These analytics use the built-in demonstration history and update when demo states are triggered. The product-style sidebar, pipeline stage progression, virtual LED signal, local simulator, and optional S3 `status.json` polling integration are retained. Demo analytics are illustrative and are not historical AWS metrics unless populated by a real integration.

## 1. Business use case

**User:** DevOps engineers, developers, QA teams, and small software teams.

**Problem:** Build failures can be missed when team members are not continuously watching the CI/CD console. Delayed awareness can delay debugging and deployments.

**Solution:** Pipeline Pulse turns pipeline execution events into a highly visible status signal. A team member can glance at one screen and see whether the latest build passed, failed, or is still running.

**Business value:** Faster awareness of failed builds, less repeated console checking, and a shared status view for a development team. This is a lightweight awareness tool; it does not replace logs, alerting, incident management, or pipeline troubleshooting.

## 2. Difference from existing market tools

CI/CD platforms such as Jenkins, GitLab CI/CD, GitHub Actions, and AWS CodePipeline already show build status in their own web interfaces. Monitoring and chat tools can also send notifications.

Our project is **not claiming to invent build monitoring**. Its distinction is a deliberately minimal, glanceable status surface that translates pipeline state into a virtual LED-strip metaphor. It is intended as a low-cost team-room/status-board prototype and a teaching demonstration of event-driven cloud integration. Commercial tools generally offer much broader workflow, analytics, permissions, and notification capabilities.

## 3. Architecture

```text
AWS CodePipeline
      |
      | Pipeline execution state-change event
      v
Amazon EventBridge rule
      |
      v
AWS Lambda
      |
      | writes status.json
      v
Amazon S3  <---- Static website files (index.html, CSS, JS)
      |
      v
Browser dashboard (virtual RGB LED strip)
```

**AWS services (4):**
1. **AWS CodePipeline** — produces pipeline execution status events.
2. **Amazon EventBridge** — matches pipeline execution state changes and invokes Lambda.
3. **AWS Lambda** — converts the event into a small JSON status record.
4. **Amazon S3** — stores the static dashboard and `status.json`.

The browser polls `status.json` every 15 seconds. The front end also has local demo controls so the dashboard can be demonstrated without AWS access.

### Hardware conversion

| Original item | Project implementation |
|---|---|
| ESP32 | Browser JavaScript simulates the controller |
| RGB LED strip | 12 virtual LED segments in the dashboard |
| Physical button | Digital success/failure/running buttons |
| AWS IoT Core | Not required for this software-only version |

**Why IoT Core is omitted:** the physical IoT device is being replaced by a browser simulation. Adding IoT Core would increase setup without improving the core business demonstration. It can be considered as a future hardware extension if the instructor specifically requires IoT Core.

## 4. Run the dashboard locally

1. Extract the ZIP.
2. Open `index.html` in Chrome or Firefox.
3. Click **Simulate success**, **Simulate failure**, and **Simulate running**.
4. Watch the virtual LED strip, status label, timestamp, and recent activity update.

Local demo controls are functional without AWS credentials or an internet connection (the optional Google font requires internet; system fonts remain as fallback).

## 5. Deploy the static dashboard to AWS Learner Lab

Use **us-east-1**, unless your faculty specifies otherwise. Start the Learner Lab and open the AWS Console through the lab page.

1. Create one S3 bucket with a globally unique name.
2. Upload `index.html`, `styles.css`, and `app.js`.
3. In **Properties → Static website hosting**, enable hosting and set `index.html` as the index document.
4. For a classroom-only demo, configure read access only as permitted by your lab and instructor. Do not make a bucket public if policy does not allow it. If public website hosting is blocked, run the dashboard locally and use the AWS integration through a permitted hosting method.
5. Note the S3 website endpoint shown by the console.

**Important:** S3 static website hosting uses a public website endpoint. A public bucket policy may be prohibited by your Learner Lab. Follow your instructor's policy; do not weaken account security to force deployment.

## 6. Configure the AWS event integration

This is an optional integration path and requires permission to create/configure EventBridge rules, Lambda functions, and invoke permissions in your Learner Lab.

1. Create a Lambda function using Python 3.x and upload `lambda_function.py`.
2. Add environment variable `STATUS_BUCKET` with your bucket name. `STATUS_KEY` is optional and defaults to `status.json`.
3. Configure the Lambda execution role to allow `s3:PutObject` only for `arn:aws:s3:::YOUR_BUCKET/status.json`. Use the provided lab role if your environment requires it; do not create an IAM user.
4. Create an EventBridge rule using the pattern in `event-pattern.json`, targeting your Lambda function.
5. Ensure EventBridge is permitted to invoke the Lambda function. The console may add the required resource permission when you select the Lambda target.
6. Run a CodePipeline execution and observe the Lambda invocation in its Monitor/CloudWatch logs.
7. Confirm that `status.json` appears in the S3 bucket.
8. Open or refresh the dashboard. It checks `status.json` automatically every 15 seconds.

If the Learner Lab restricts Lambda roles, EventBridge, or CodePipeline, use the local simulator for the UI demo and show the Lambda test with `sample-event.json` only if Lambda test permissions are available. Do not claim a live integration unless the status object is actually being updated by a real pipeline event.

### Sample status object

```json
{
  "pipelineName": "student-app-pipeline",
  "executionId": "sample-exec-001",
  "status": "FAILED",
  "stage": "Build",
  "updatedAt": "2026-11-15T00:00:00+00:00",
  "source": "AWS CodePipeline"
}
```

## 7. Test plan / proof to collect

| Test | Action | Expected evidence |
|---|---|---|
| UI pass | Click Simulate success | Green LED strip and SUCCEEDED |
| UI fail | Click Simulate failure | Red LED strip and FAILED |
| UI running | Click Simulate running | Amber LED pattern and IN PROGRESS |
| Lambda | Test with `sample-event.json` | Lambda response and S3 `status.json` object |
| Event integration | Execute real pipeline | EventBridge match, Lambda log, updated S3 object |
| Connected UI | Open dashboard with status object | AWS STATUS CONNECTED label and cloud status |

Capture screenshots of: dashboard success, dashboard failure, Lambda test result, S3 `status.json`, EventBridge rule/target, and CodePipeline execution. These are the proof items that help demonstrate Level 2 and Level 3 progress under the course maturity guide.

## 8. Reliability, security, and cost

- Lambda validates the event state against a small allow-list.
- S3 object is written with `Cache-Control: no-store`; the browser also adds a cache-busting query string.
- Keep the Lambda permission limited to the one status object.
- Do not put credentials, secrets, or personal information in the status JSON.
- The demo is event-driven and uses short Lambda execution rather than a continuously running server.
- Stop/delete resources when the lab is finished, following faculty instructions. Do not click **Reset** unless faculty directs you.
- Actual charges and service availability depend on the Learner Lab account and its permissions. Check the lab budget; do not assume every AWS service is enabled.

## 9. Scope and limitations

- This starter project shows the latest received pipeline state, not full build logs or root-cause analysis.
- It does not authenticate dashboard users. Do not publish sensitive pipeline metadata on a public website.
- The local simulation is not proof of AWS integration. For a connected demo, show a real pipeline event flowing through EventBridge and Lambda to S3.
- A browser dashboard is a software substitute for the ESP32/LED hardware, not a physical IoT device.

## 10. Five-member team role split

1. **Product Lead:** business problem, user story, demo script, faculty pitch.
2. **Cloud Architect:** AWS architecture, service selection, permissions and cost notes.
3. **Frontend/UI:** dashboard layout, virtual LED strip, responsive styling.
4. **Backend/Data:** Lambda event parsing and S3 status object.
5. **QA/Documentation:** test cases, screenshots, setup guide, limitations and final report.

Each member should record their actual individual contribution; do not submit identical contribution statements.

## 11. Two-minute project pitch

“Our target users are developers and DevOps teams. They need to know quickly whether the latest software build passed or failed. Pipeline Pulse listens for AWS CodePipeline execution events. EventBridge routes the event to Lambda, and Lambda stores the latest result in S3. Our dashboard reads that status and displays it as a virtual LED strip: green for success, red for failure, and amber for a running build. Unlike full CI/CD platforms, our project focuses on one simple glanceable status view. It is a low-cost prototype for team awareness, not a replacement for a full DevOps platform. We considered Learner Lab limits by using a small serverless architecture and replacing physical hardware with a software simulation.”

## 12. Tools used

- HTML5 — dashboard structure
- CSS3 — responsive UI and requested color palette
- JavaScript — digital controls, LED simulation, polling
- Python 3 / AWS Lambda — event processing
- Amazon S3 — static website and status JSON
- Amazon EventBridge — event routing
- AWS CodePipeline — build status source
- AWS Learner Lab Console — cloud setup and testing

**Status of this ZIP:** source code and local simulation are provided. AWS deployment and live event integration are configuration steps you must perform in your own Learner Lab; no AWS resources have been created by this package.


## Version 1.4 — Virtual device build-control interface

The dashboard now presents a virtual ESP32-style software device connected to an eight-segment LED strip. The build-control panel lets the presenter select a sample application and run a local test scenario:

- **Healthy code · expected pass:** dependency, compilation, and smoke checks pass; the strip turns sage green.
- **Introduce regression · expected fail:** compilation fails; the strip turns coral/red.
- **Long-running checks · expected pass:** a longer local test completes successfully; the strip turns amber while running, then sage green.

The local runner waits for the selected scenario duration and emits a browser-side event object using the AWS CodePipeline state-change event naming shape. This is a local simulation: it does not start a real CodePipeline execution, deploy an application, or invoke AWS services.

### Palette
- Sage green: `#87A96B`
- Walnut brown: `#5A3E2B`
- Amber glow: `#D5851F`

### Live AWS status
The optional AWS path remains available. The Lambda function can write `status.json` to the S3 dashboard bucket, and the browser polls it every 15 seconds. A real AWS-connected result is shown only when a valid `status.json` is returned. The local test runner and cloud status display are separate paths.

### Demo sequence
1. Open `index.html` in a browser or with VS Code Live Server.
2. Select **Healthy code** and click **Run local build**. Observe amber while it runs, then sage green after the checks pass.
3. Select **Introduce regression** and run again. Observe the failure signal and failed compilation check.
4. Select **Long-running checks** to demonstrate the longer running state.
5. Explain that local mode demonstrates the interface and event shape; a real pipeline event requires the AWS integration steps above.


## V1.4.1 display consistency fix

- LED segments are explicitly painted sage green (passed), coral red (failed), and amber (running), including inline colour safeguards.
- An active local test run is not overwritten by the periodic optional AWS status poll.
- Asset URLs include a version query to prevent stale browser-cached JavaScript/CSS from mixing versions.
- Local pass/fail messages now match the final build result.


## V1.4.2 state consistency fix

A local event now explicitly serializes the selected result as `detail.state: status`. The previous shorthand accidentally referenced the global dashboard state object, causing a failed-state fallback while healthy sample checks and deployment details remained visible.

The local runner now uses a `try/catch/finally` lifecycle. The final status, message, validation checks, LED strip, stage progress, and history are all derived from the same normalized result. The `finally` block always returns the Run button and local transport to READY, including when an unexpected error occurs. History rendering safely stringifies status values. Repeated AWS execution IDs are ignored, and stale cloud snapshots are briefly suppressed after a local demo completes.
