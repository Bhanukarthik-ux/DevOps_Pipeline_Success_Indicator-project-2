const $ = (id) => document.getElementById(id);
const state = { history: [], counter: 1, busy: false, cloudConnected: false, lastCloudExecutionId: null, lastLocalFinishedAt: 0 };
const samples = {
  healthy: { name:"Healthy code", result:"SUCCEEDED", stage:"Deploy", duration:4, checks:[["Dependency check","pass"],["Build compilation","pass"],["Smoke test","pass"]], message:"The latest local build passed all validation checks." },
  regression: { name:"Regression sample", result:"FAILED", stage:"Build", duration:4, checks:[["Dependency check","pass"],["Build compilation","fail"],["Smoke test","pending"]], message:"A failure was detected. Review the failed validation check." },
  slow: { name:"Extended checks", result:"SUCCEEDED", stage:"Deploy", duration:6, checks:[["Dependency check","pass"],["Build compilation","pass"],["Extended smoke test","pass"]], message:"Extended checks completed successfully." }
};
const statusInfo = {
  SUCCEEDED:{title:"Build passed",chip:"SUCCEEDED",orb:"success",caption:"The latest observed pipeline execution succeeded.",led:"on",symbol:"✓"},
  FAILED:{title:"Build failed",chip:"FAILED",orb:"failed",caption:"A failure needs your attention. Inspect the build logs.",led:"fail",symbol:"!"},
  IN_PROGRESS:{title:"Build running",chip:"IN PROGRESS",orb:"running",caption:"The pipeline is processing the selected sample.",led:"run",symbol:"↻"}
};
function clockTick(){ $("clock").textContent = new Date().toLocaleTimeString(); }
clockTick(); setInterval(clockTick,1000);

function setLeds(status){
  const palette = {
    SUCCEEDED: { cls:"on", color:"#87A96B", border:"#C1D4A9", glow:"0 0 18px #87A96BCC, inset 0 0 5px #efffdd" },
    FAILED: { cls:"fail", color:"#E47C68", border:"#F0B1A5", glow:"0 0 20px #E47C68CC, inset 0 0 5px #fff" },
    IN_PROGRESS: { cls:"run", color:"#D5851F", border:"#F3C27B", glow:"0 0 18px #D5851FCC, inset 0 0 5px #fff" }
  };
  const style = palette[status] || palette.FAILED;
  document.querySelectorAll("#led-strip .led").forEach(led=>{
    led.className = "led " + style.cls;
    led.style.backgroundColor = style.color;
    led.style.borderColor = style.border;
    led.style.boxShadow = style.glow;
    led.style.opacity = "1";
  });
}
function setStages(status, stage){
  const names=["Source","Build","Test","Deploy"];
  const stop=status==="FAILED"?1:status==="IN_PROGRESS"?2:4;
  $("stage-list").innerHTML=names.map((name,i)=>{
    let cls = status==="SUCCEEDED" ? "done" : i<stop ? "done" : i===stop ? (status==="FAILED"?"failed":"current") : "";
    return `<span class="stage ${cls}">${name}</span>`;
  }).join("");
  $("stage-progress-label").textContent=status==="SUCCEEDED"?"4 / 4 complete":status==="FAILED"?"Stopped at Build": "3 / 4 in progress";
}
function renderChecks(checks){
  $("test-count").textContent=`${checks.length} CHECKS`;
  $("test-list").innerHTML=checks.map(([name,result])=>{
    const symbol=result==="pass"?"✓":result==="fail"?"!":"·";
    const label=result==="pass"?"Passed":result==="fail"?"Failed":"Skipped";
    return `<div class="test-row"><span class="test-check ${result}">${symbol}</span><span>${name}</span><b class="${result==="fail"?"failed-text":""}">${label}</b></div>`;
  }).join("");
}
function renderHistory(){
  const filter=$("history-filter").value;
  const rows=state.history.filter(x=>filter==="ALL"||x.status===filter).slice(0,6);
  $("history-count").textContent=`${rows.length} RUN${rows.length===1?"":"S"}`;
  $("history-body").innerHTML=rows.length?rows.map(x=>`<tr><td>${x.id}</td><td>${x.application}</td><td>${x.stage}</td><td>${x.time}</td><td><span class="table-result ${String(x.status).toLowerCase()}">${x.status==="SUCCEEDED"?"PASSED":x.status==="FAILED"?"FAILED":"RUNNING"}</span></td></tr>`).join(""):'<tr><td colspan="5">No runs match this filter.</td></tr>';
}
function renderStatus(status, details={}){
  const info=statusInfo[status]||statusInfo.FAILED;
  $("status-orb").className="status-orb "+info.orb;
  $("status-title").textContent=info.title;
  $("status-message").textContent=details.message||info.caption;
  $("status-chip").textContent=info.chip;
  $("status-chip").className="status-chip "+info.orb;
  $("updated-at").textContent=details.updatedAt||new Date().toLocaleString();
  $("execution-id").textContent=details.executionId||"pulse-local-"+String(state.counter).padStart(3,"0");
  $("stage-name").textContent=details.stage||"Deploy";
  $("duration").textContent=details.duration?details.duration.toFixed(1)+"s":"—";
  setLeds(status);setStages(status,details.stage);
  if(details.checks) renderChecks(details.checks);
}
function updateTransport(running, cloud=false){
  $("transport-indicator").style.background=running?"var(--amber)":cloud?"var(--sage)":"var(--sage)";
  $("transport-title").textContent=cloud?"AWS event transport":"Local event transport";
  $("transport-copy").textContent=cloud?"Status received from S3 status.json":"Same event format as CodePipeline";
  $("transport-state").textContent=running?"PROCESSING":cloud?"CONNECTED":"READY";
  $("transport-state").style.color=running?"var(--amber)":"var(--sage)";
}
function addHistory(id,application,status,stage){
  state.history.unshift({id,application,status,stage,time:new Date().toLocaleTimeString()});
  renderHistory();
}
function localEvent(status,application,stage,duration){
  // A local event follows the relevant CodePipeline state-change detail shape.
  return {source:"aws.codepipeline", "detail-type":"CodePipeline Pipeline Execution State Change", time:new Date().toISOString(), detail:{pipeline:"student-app-pipeline", "execution-id":"pulse-local-"+String(state.counter).padStart(3,"0"), state:status, stage, application, duration_seconds:duration, transport:"local-simulator"}};
}
async function runBuild(){
  if(state.busy)return;
  state.busy=true;
  const button=$("run-build"), label=$("run-label"), appKey=$("sample-app").value;
  const sample=samples[appKey] || samples.healthy;
  state.counter++;
  const id="pulse-local-"+String(state.counter).padStart(3,"0");
  let completedStatus="FAILED";
  let completedStage="Build";
  let completedDuration=sample.duration;
  let completedChecks=[["Local test runner","fail"]];
  let completedApplication=sample.name;
  let completedMessage="The local test could not complete. Please try again.";

  button.disabled=true;
  label.textContent="Running local build…";
  $("run-caption").textContent="Executing sample checks · please wait";
  try{
    renderStatus("IN_PROGRESS",{
      executionId:id, stage:"Build",
      message:"The local test run is in progress. The LED strip is amber while checks are running.",
      duration:0
    });
    updateTransport(true);
    renderChecks([
      ["Dependency check","pending"],
      ["Build compilation","pending"],
      ["Smoke test","pending"]
    ]);

    await new Promise(resolve=>setTimeout(resolve,sample.duration*1000));

    const event=localEvent(sample.result,sample.name,sample.stage,sample.duration);
    const rawStatus=event.detail.state;
    const allowedStatuses=["SUCCEEDED","FAILED"];
    if(!allowedStatuses.includes(rawStatus)){
      throw new Error("Invalid local build status in event payload");
    }

    completedStatus=rawStatus;
    completedStage=event.detail.stage;
    completedDuration=event.detail.duration_seconds;
    completedChecks=sample.checks;
    completedApplication=sample.name;
    completedMessage=completedStatus==="FAILED"
      ? "The local build failed during compilation. Review the failed validation check."
      : "The local build passed all validation checks.";

    renderStatus(completedStatus,{
      executionId:id,
      stage:completedStage,
      message:completedMessage,
      duration:completedDuration,
      checks:completedChecks
    });
    addHistory(id,completedApplication,completedStatus,completedStage);
    $("run-caption").textContent=`Completed in ${completedDuration.toFixed(1)} seconds · local simulation`;
  }catch(error){
    console.error("Local build simulation error:",error);
    completedStatus="FAILED";
    completedStage="Build";
    completedChecks=[["Local test runner","fail"]];
    completedMessage="The local test runner encountered an error. The run has been stopped.";
    renderStatus(completedStatus,{
      executionId:id,
      stage:completedStage,
      message:completedMessage,
      duration:completedDuration,
      checks:completedChecks
    });
    addHistory(id,completedApplication,completedStatus,completedStage);
    $("run-caption").textContent="Run stopped · local simulation error";
  }finally{
    // Always release the UI, even if rendering, event validation, or history fails.
    updateTransport(false);
    button.disabled=false;
    label.textContent="Run local build";
    state.busy=false;
    state.lastLocalFinishedAt=Date.now();
  }
}
$("run-build").addEventListener("click",runBuild);
$("history-filter").addEventListener("change",renderHistory);

// Seed history is illustrative. New rows are generated by the local test runner.
state.history.push({id:"pulse-demo-001",application:"Healthy code",status:"SUCCEEDED",stage:"Deploy",time:"Just now"});
renderHistory();
renderStatus("SUCCEEDED",{executionId:"pulse-demo-001",stage:"Deploy",duration:4,message:"The latest observed pipeline execution succeeded.",checks:samples.healthy.checks});
updateTransport(false);

// Optional cloud path: Lambda writes status.json into the static dashboard S3 bucket.
async function loadCloudStatus(){
  try{
    const response=await fetch("./status.json?ts="+Date.now(),{cache:"no-store"});
    if(!response.ok)return;
    const data=await response.json();
    if(!data.status)return;
    // Do not let periodic AWS polling overwrite an active local demonstration.
    if(state.busy)return;
    const cloudExecutionId=data.executionId||data.execution_id||null;
    if(cloudExecutionId && cloudExecutionId===state.lastCloudExecutionId)return;
    // Ignore an old status snapshot briefly after a local demo finishes.
    if(Date.now()-state.lastLocalFinishedAt<12000)return;
    state.cloudConnected=true;
    state.lastCloudExecutionId=cloudExecutionId;
    $("pipeline-name").textContent=data.pipelineName||"student-app-pipeline";
    $("cloud-copy").textContent="Latest status received from S3";
    $("cloud-state").textContent="CONNECTED";
    $("cloud-state").style.color="var(--sage)";
    $("data-source").textContent="AWS STATUS.JSON CONNECTED";
    $("device-id").textContent="aws-pipeline";
    const mapped=["SUCCEEDED","FAILED","IN_PROGRESS"].includes(data.status)?data.status:"FAILED";
    renderStatus(mapped,{executionId:data.executionId||"aws-execution",stage:data.stage||"Pipeline",updatedAt:data.updatedAt||new Date().toLocaleString(),message:mapped==="FAILED"?"AWS CodePipeline reported a failed execution. Inspect the pipeline execution details.":mapped==="SUCCEEDED"?"AWS CodePipeline reported a successful execution.":"AWS CodePipeline reported an execution in progress."});
    addHistory(data.executionId||"aws-execution",data.pipelineName||"AWS pipeline",mapped,data.stage||"Pipeline");
    updateTransport(false,true);
  }catch(error){/* Local test runner remains usable if cloud status is not configured. */}
}
loadCloudStatus();
setInterval(loadCloudStatus,15000);
