global.fetch = require("node-fetch");
const Actor = require("@dfinity/agent").Actor
const HttpAgent = require("@dfinity/agent").HttpAgent
// filesystem
const fs = require('fs')
// execute os commands
const { spawn, exec, spawnSync, execSync, execFile } = require('child_process')
// import shelljs and use it to verify itself and other necessaries
const shell = require('shelljs')
const http = require('http');
const { v4: uuidv4 } = require('uuid');


// set a human-readable timestamp per worker system clock\
var localTime = Date.now();
console.log ("localTime: ",localTime) ;
var d = Date(Date.now())

// and unix time, which we'll store and communicate with
let currentUnixTime = Math.floor(new Date().getTime() / 1000)
console.log ("unixtime =" +currentUnixTime);

const WORKSPACE_DIR = __dirname;

// ENV vars accessibility

// read in Worker config from workerObjectLocal.json
if (fs.existsSync(`${WORKSPACE_DIR}/../worker.config.env`)) {
  console.log("production env");
  require ('dotenv').config({path:__dirname+'/../worker.config.env'})
} else {
  console.log("local env");
  require ('dotenv').config({path:__dirname+'/.env'})
}

// shorthand some ENV vars for brevity further on
const ICPM_AUTH_TOKEN = process.env.ICPM_AUTH_TOKEN
const WORKER_MODE = process.env.WORKER_MODE
const GITHUB_AUTH_TOKEN = process.env.GITHUB_AUTH_TOKEN
const ICPM_CANISTER_ID = process.env.ICPM_CANISTER_ID
const ICPM_CANISTER_ID_LOCAL = process.env.ICPM_CANISTER_ID_LOCAL
const DEBUG_MODE = process.env.DEBUG_MODE;
const NETWORK_MODE = process.env.NETWORK_MODE;

console.log ("WORKER_MODE =" +WORKER_MODE);

if (WORKER_MODE == "DEV" ) { 
  console.log ("process.env: ", process.env); 
}

// change to workspace_DIR
shell.cd(WORKSPACE_DIR);
// bring in IDL declarations from data canister
require (`${WORKSPACE_DIR}/node-icpm.did.js`)
// set up logging utility (ref: `${WORKSPACE_DIR}/logger.js')
var logger = require(`${WORKSPACE_DIR}/logger`).logger
var haveDeployment = false;
var uplinkLog = '';
var uplinkResponse = [];
const jobLogsPath = `${WORKSPACE_DIR}/log/jobLogs/`
var jobLogFile = '';
var deployToNetwork = "local" ;


var dfxJson = "";
var dfxJsonObject = "";
var dfxConfigFile = "";
var dfxReplicaType = "emulator";
const os = require('os')

// now we use this to get the home folder

const homeDirectory = os.homedir();
console.log ("homeDirectory: ", homeDirectory); 


// lets check the deployment architecture
var thisWorkerCategory = "docker-secured";

if (NETWORK_MODE == "public") {

  thisWorkerCategory = "docker-public";
}



/////  ****************** END COPIED FROM HEADER OF UPLINK


// first we check for a config folder

if (fs.existsSync(`${WORKSPACE_DIR}/config`)) {
  
  console.log("There is a Config folder.");

} else {

  console.log("There is NOT a Config folder. Created one.");
  shell.mkdir('-p', `${WORKSPACE_DIR}/config`);

}


// we need to check if there is a deployments folder and if not create one

if (fs.existsSync(`${WORKSPACE_DIR}/../deployments`)) {
  
  console.log("There is a Deployments folder");

} else {

  console.log("There is NOT a Deployments folder. Created one.");
  shell.mkdir('-p', `${WORKSPACE_DIR}/../deployments`);

}

if (fs.existsSync(`${homeDirectory}/.config/dfx/identity/icpipeline`)) {
  
  console.log("There is a icpipeline identity folder");

} else {

  console.log("There is NOT an icpipeline identity folder. Created one.");
  shell.mkdir('-p', `${homeDirectory}/.config/dfx/identity/icpipeline`);

}

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}



uplinkLog += logger.processLog('s','LOADING - just got environment variables, opening workerObjectLocal files and start logs');


uplinkLog += logger.processLog('s','BEGIN- uplink.js - ICPW - worker phone home to ICPM started');

// this script runs frequently and containers will generally have modest resources,
// so we will avoid overlapping runs using an if-exists artifact.

scriptProcessId = process.pid ;

fs.writeFileSync(`${WORKSPACE_DIR}/config/pid`, 'Worker uplink in progress - PID: '+scriptProcessId )
uplinkLog += logger.processLog('s','CREATED PID FILE - Worker uplink in progress - PID: '+scriptProcessId ) ;
 
// check for software 

if (!shell.which('git') || !shell.which('node') || !shell.which('npm')) {
  
  
  uplinkLog += logger.processLog('e','ERROR @DEPENDENT SOFTWARE CHECK - One or more crucial software tools not present on Worker system')
  shell.exit(1)
} else {
  uplinkLog += logger.processLog('s','DEPENDENT SOFTWARE CHECK - Node, npm, git and shelljs all detected on Worker system')
}

// retrieve the local IP that should be our "en0" interface,
// for injection into workerObjectLocal prior to its registration handshake with ICPM,
  const interfaces = os.networkInterfaces()
  //console.log ("interfaces: ", interfaces);
  var workerPrivateIpAddress = "" ;
  
  for (const name of Object.keys(interfaces)) {

    for (const network of interfaces[name]) {

      // screen ipv6 and internal interfaces ... should be redundant
      if (network.family === 'IPv4' && !network.internal && name === 'eth1') {

        workerPrivateIpAddress = network.address

    } else if (network.family === 'IPv4' && !network.internal && name === 'eth0' ) {

        workerPrivateIpAddress = network.address

    }
      if (network.family === 'IPv4' && !network.internal && name === 'en0' && WORKER_MODE == "DEV") {

          workerPrivateIpAddress = network.address

      }

    }

  } 



console.log ("workerPrivateIpAddress:", workerPrivateIpAddress);

var workerPublicIpAddress ='';

try {
  if (fs.existsSync(`${WORKSPACE_DIR}/../worker.public.ip`)) {
    workerPublicIpAddress = fs.readFileSync(`${WORKSPACE_DIR}/../worker.public.ip`, 'utf8' ); // end read pid 
  }// end if exists
} catch (err) {
  console.error(err)
}

//Docker public IP is a work in progress, going to use the UNIX timestamp as a stop gap 

var workerUniqueId= uuidv4();
console.log("workerUniqueId: ", workerUniqueId);  



uplinkLog += logger.processLog('s',`GET IP ADDRESS - private/public addresses to register with the ICPM: ${workerPrivateIpAddress}/${workerPublicIpAddress}`) ;


// set up pointers to logs for dfx and git
const dfxLogFile = `${WORKSPACE_DIR}/log/dfx.log`
// console.log(dfxLogFile)
const gitLogFile = `${WORKSPACE_DIR}/log/git.log`
// console.log(gitLogFile)

// read in Worker config from workerObjectLocal.json
if (!fs.existsSync(`${WORKSPACE_DIR}/config/workerObjectLocal.json`)) {

  uplinkLog += logger.processLog('s','WARNING - no workerObjectLocal.json File');
  // IF this Worker has not previously registered with ICPM, we write its real IP address to workerObjectLocal.json
  // prior to ICPM registration (i.e. so the actual address is registered).
  // workerObjectLocal.json remains otherwise default pending registration with ICPM.


  // now we create a new one 

  const workerObjectNew = {
    id: 0,
    name: "",
    status: "",
    category: thisWorkerCategory,
    description: "",
    lastDeploymentId: 0,
    uniqueId: workerUniqueId,
    publicIp: workerPublicIpAddress,
    privateIp: workerPrivateIpAddress,
    dnsName: "",
    iiEnabled: "N",
    dfxReplicaType: "emulator",
    ttydHttpsEnabled:"N",
    ttydHttpsCount: 0,
    lastTouch: 0,
    creatorId: 0,
    dateCreated: 0,
    lastUpdated: 0,
  }

  // (synchronously) write defaults + IP back to workerObjectLocal
  try {

    fs.writeFileSync(`${WORKSPACE_DIR}/config/workerObjectLocal.json`, JSON.stringify(workerObjectNew, null, 2))
      
    uplinkLog += logger.processLog('s',`SAVE WORKER OBJECT LOCAL - added IP and new data to workerObjectLocal file since registation file did not exists`) ;

  } catch (error) {

    uplinkLog += logger.processLog('e','ERROR SAVE WORKER OBJECT LOCAL - Something went wrong with IP address injection to workerObjectLocal: ' +error) ;

  } // end catch for update to workerObjectLocal.json

 } // end workerObjectLocal check
 // now we load the workerObject 

 globalThis.workerObjectLocal = require(`${WORKSPACE_DIR}/config/workerObjectLocal.json`)


uplinkLog += logger.processLog('s','INITIALIZE DFX AGENT - initialize http agent (note network mode: local or IC) and actor, pulling in IDL declarations');

var canisterId = "";
var agent;

if (WORKER_MODE == "DEV") { 
  agent = new HttpAgent( {
    host: "http://localhost:8000",
  });
  canisterId = ICPM_CANISTER_ID_LOCAL;

} else {
 agent = new HttpAgent( {
    host: "https://boundary.ic0.app/",
  });
  canisterId = ICPM_CANISTER_ID;
} // end if dev 

// initialize actor, passing in IDL declarations
const actor = Actor.createActor(idlFactory, {
    agent,
    canisterId
})


// NOTE: this is required for update calls on local dev environment, shouldn't be used in production
if (WORKER_MODE == "DEV") { agent.fetchRootKey() }

uplinkLog += logger.processLog('s','DFX ACTOR CREATED');




// **********************************************
// Commence uplink(), activities relating to work payload
// **********************************************
uplinkLog += logger.processLog('s' , 'ICPM UPLINK READY TO START CALLING')

let uplink = async () => {

  haveDeployment = false;
  shell.cd(WORKSPACE_DIR);


  // if the log is populated we need to push to the IC then reset
  uplinkLog = '';



  uplinkLog += logger.processLog('s' , `ICPM UPLINK - Initializing canister call to ICPM.`)

  // ***************** ICPM HANDSHAKE SECTION ***********************
  // handles auth/identity/handshake with ICPM, including initial "announce"
  // of this worker to ICPM.  NOTE, Worker is "born" with its ICPM canisterId preset as ENV var
  // ****************************************************************

  //console.log(workerObjectLocal)

  // execute main canister call to ICPM
  uplinkResponse = await actor.workerUplink(ICPM_AUTH_TOKEN, workerObjectLocal).catch(e => { return "ICPM Error: " + e })
  
  let uplinkResponseString = JSON.stringify (uplinkResponse, (key, value) =>
      typeof value === 'bigint'
          ? Number(value)
          : value // return everything else unchanged
      , 2)
  
    //console.log ("uplinkResponseString: ", uplinkResponseString);
  
  if (uplinkResponseString.includes('ICPM Error')) {

    uplinkLog += logger.processLog('e',`ICPM ERROR - ${canisterId} - Error Response: ${uplinkResponse}`)

  } else {

    uplinkLog += logger.processLog('s',`ICPM UPLINK - Response received from ICPM.`)

  //console.log(uplinkResponse)

  // whether the first time or not we will write the registration file as a sign of a success conversation with the ICPM
  // also create the Worker registration file
  try { 
    fs.writeFileSync(`${WORKSPACE_DIR}/config/worker.icpm.registration`, `Worker ${uplinkResponse.workerObject.id} is registered with ICPM ${canisterId}`)
    uplinkLog += logger.processLog('s',`WRITING REGISTRATION - Worker ${uplinkResponse.workerObject.id} is registered with ICPM ${canisterId}`) ;
  } catch (error) {
    uplinkLog += logger.processLog('e','ERROR WRITING REGISTRATION - Worker registration file did not write to disk') ;
  } // end catch for check/set of registration file  
  
  if (DEBUG_MODE == "debug") {
    // write full response to a file
    fs.writeFileSync(`${WORKSPACE_DIR}/responses/ICPM-workerUplinkResponse-${currentUnixTime}.json`, uplinkResponseString);
    uplinkLog += logger.processLog('s','WRITING RESPONSE OBJECT TO FILE - logging response in responses with repsonse (ICPM-workerUplinkResponse-'+currentUnixTime+'.json)' ) ;
  } // end debugmode

  // write config updates to workerObjectLocal.json
  if (uplinkResponse.workerObject.id > 0)  {

      
    fs.writeFileSync(`${WORKSPACE_DIR}/config/workerObjectLocal.json`, JSON.stringify (uplinkResponse.workerObject, (key, value) =>
                  typeof value === 'bigint'
                      ? Number(value)
                      : value // return everything else unchanged
                  , 2));

    workerObjectLocal = uplinkResponse.workerObject ;


  } else {

    // we need reset the local file
      const workerObjectNew = {
        id: 0,
        name: "",
        status: "",
        category: thisWorkerCategory,
        description: "",
        lastDeploymentId: 0,
        uniqueId: workerUniqueId,
        publicIp: workerPublicIpAddress,
        privateIp: workerPrivateIpAddress,
        dnsName: "",
        iiEnabled: "N",
        dfxReplicaType: "emulator",
        ttydHttpsEnabled:"N",
        ttydHttpsCount: 0,
        lastTouch: 0,
        creatorId: 0,
        dateCreated: 0,
        lastUpdated: 0,
      }

      // (synchronously) write defaults + IP back to workerObjectLocal
      try {

        fs.writeFileSync(`${WORKSPACE_DIR}/config/workerObjectLocal.json`, JSON.stringify(workerObjectNew, null, 2))
          
        uplinkLog += logger.processLog('s',`SAVE WORKER OBJECT LOCAL - added IP and new data to workerObjectLocal file since registation file did not exists`) ;

      } catch (error) {

        uplinkLog += logger.processLog('e','ERROR SAVE WORKER OBJECT LOCAL - Something went wrong with IP address injection to workerObjectLocal: ' +error) ;

      } // end catch for update to workerObjectLocal.json

      workerObjectLocal = workerObjectNew;

  } // end if the workerObject is valid

  uplinkLog += logger.processLog('s','WRITING WORKER OBJECT TO FILE - updated workerObjectLocal with response worker' ) ;

  // *************************************************************
  // ICPM conversation complete, proceeding into task workflow
  // *************************************************************

  // onboard remainder of ICPM response data.
  // we'll set/type every field.  there'll be some deadwood in the short term but it should save some
  // head-scratching down the road.  it all needs to work.  again, all fields typed per ICPM/Motoko.

  // ICPM's top-level, overall status code [Red, Yellow, Green] for this response
  let icpmResponseStatus = uplinkResponse.responseStatus.toString()
  let icpmResponseMsg = ((uplinkResponse.msg.toString()) ? uplinkResponse.msg.toString() : "none")
  
  uplinkLog += logger.processLog('s',`ICPM UPLINK STATUS - Worker ${workerObjectLocal.id} - response status: ${icpmResponseStatus} - msg: ${icpmResponseMsg}`)

  // ************************************************
  // Commence processing logic against response from ICPM.
  // First step is an Environment assignment without which nothing else happens.
  // ************************************************

  // If ICPM has returned an Environment we proceed

  if(uplinkResponse.environmentObject.id > 0) {
    
    // ICPM has sent Worker an Environment.  write assignment whether done previously or not.
      try {

        fs.writeFileSync(`${WORKSPACE_DIR}/config/worker.icpm.environment`, `Worker ${workerObjectLocal.id} is assigned to Environment ${uplinkResponse.environmentObject.name} (${uplinkResponse.environmentObject.id}) by ICPM ${canisterId}`)
        uplinkLog += logger.processLog('s',`ICPM UPLINK RESPONSE - Worker ${workerObjectLocal.id} assigned to Environment ${uplinkResponse.environmentObject.name} (${uplinkResponse.environmentObject.id}) by ICPM ${canisterId}`)
    
      } catch (error) {
    
        uplinkLog += logger.processLog('e','ERROR ICPM UPLINK RESPONSE - Something amiss with creation of worker.icpm.environment');
    
      } // end try/catch

    // ************************************************
    // Worker has an assigned environment, next check whether pending work is assigned to Worker by ICPM
    // ************************************************
    uplinkLog += logger.processLog('s',`ICPM UPLINK JOB CHECK - check for a job assignment.`)
    
    var uplinkJobLog = "";

    // first check if there is a job for Worker to do
    if(uplinkResponse.jobObject.id > 0) {

      uplinkLog += logger.processLog('s',`ICPM UPLINK RESPONSE - have a jobId: ${uplinkResponse.jobObject.id}`)
      
      
      // If Worker performs a job, create a jobLog specific to it for submission back to ICPM
      jobLogFile = `${jobLogsPath}job-${uplinkResponse.jobObject.id}.log`

      /// ********* START LOG STATUS

      localTime = Date.now();
      console.log ("localTime: ",localTime) ;

      eventTypeLog = "Status" ;
      mainRefTypeLog = uplinkResponse.jobObject.jobType;
      environmentIdLog = uplinkResponse.deploymentObject.environmentId ;
      projectIdLog = uplinkResponse.deploymentObject.projectId;
      deploymentIdLog =uplinkResponse.deploymentObject.id ;
      workerIdLog = uplinkResponse.jobObject.workerId;
      jobIdLog = uplinkResponse.jobObject.id;
      eventTextLog = `JOB START`;
      uplinkLogEvent(eventTypeLog, mainRefTypeLog, environmentIdLog, projectIdLog, deploymentIdLog, workerIdLog, jobIdLog, eventTextLog, localTime) ;

      /// ********* END LOG STATUS

      
      // whether the job type is Deploy, and confirm we have the correct Deployment. 
      if (uplinkResponse.jobObject.jobType == 'Deploy' && uplinkResponse.jobObject.refId > 0 && uplinkResponse.jobObject.refId == uplinkResponse.deploymentObject.id ) {

          
        // **********************************************************
        // **********************************************************
        // ********************* BEGIN Deploy ***********************
        // **********************************************************
        // **********************************************************
                
        haveDeployment = true;
        
    
        uplinkJobLog += logger.processLog('s',`ICPM UPLINK RESPONSE - jobId: ${uplinkResponse.jobObject.id} is a Deployment with DeploymentId: ${uplinkResponse.deploymentObject.id}`)

        // CASE: Environment is assigned and Worker has an assigned Job/Deployment to do
        uplinkJobLog += logger.processLog('s',`ICPM UPLINK RESPONSE - Commence processing deployment ${uplinkResponse.deploymentObject.id} to Environment ${uplinkResponse.environmentObject.id}`)
        
        uplinkJobLog += logger.processLog('s',`ICPM UPLINK RESPONSE - ENVIRONMENT: ${uplinkResponse.environmentObject.id} DEPLOYMENT: ${uplinkResponse.deploymentObject.id} JOB: ${uplinkResponse.jobObject.id}`)
        uplinkJobLog += logger.processLog('s',`DEPLOYMENT PROJECT REPO: ${uplinkResponse.deploymentObject.projectRepo}`)
        uplinkJobLog += logger.processLog('s',`DEPLOYMENT PROJECT BRANCH: ${uplinkResponse.deploymentObject.projectRepoBranch}`)


        // additional validation before issuing request to GH
        if(icpmResponseStatus == 'Green' && uplinkResponse.deploymentObject.status == 'Ready') {

          uplinkJobLog += logger.processLog('s',`EXECUTE DEPLOYMENT JOB - response status code: ${icpmResponseStatus} and deployment status code: ${uplinkResponse.deploymentObject.status}`)

          // want to stop it first for dfx server first so we need to see if there is an existing deployment\
          // then we can go into that folder and stop the service

          if (fs.existsSync(`${WORKSPACE_DIR}/config/deploymentObjectLocal.json`)) {
            globalThis.deploymentObjectLocal = await require(`${WORKSPACE_DIR}/config/deploymentObjectLocal.json`)

            const lastRepoUrlSections = new URL(deploymentObjectLocal.projectRepo)
            let lastRepoCloneUrl = lastRepoUrlSections.host + lastRepoUrlSections.pathname
            uplinkJobLog += logger.processLog('s',`DECONSTRUCTING LAST DEPLOYMENT - set as: ${lastRepoCloneUrl}.`)

            /// ********* START LOG STATUS

            localTime = Date.now();
            console.log ("localTime: ",localTime) ;
            
            eventTypeLog = "Status" ;
            mainRefTypeLog = uplinkResponse.jobObject.jobType;
            environmentIdLog = uplinkResponse.deploymentObject.environmentId ;
            projectIdLog = uplinkResponse.deploymentObject.projectId;
            deploymentIdLog =uplinkResponse.deploymentObject.id ;
            workerIdLog = uplinkResponse.jobObject.workerId;
            jobIdLog = uplinkResponse.jobObject.id;
            eventTextLog = `DEPLOY - DECONSTRUCTING LAST DEPLOYMENT`;
            uplinkLogEvent(eventTypeLog, mainRefTypeLog, environmentIdLog, projectIdLog, deploymentIdLog, workerIdLog, jobIdLog, eventTextLog, localTime) ;

            /// ********* END LOG STATUS

          if (WORKER_MODE != "DEV") { 
            const dfxKill = shell.exec (`killall dfx`,  { silent: true, async: false });
                
            uplinkJobLog += logger.processLog('s',`DFX SERVICE KILL - standard out: ${dfxKill.stdout}`);
  
            if (dfxKill.stderr) {
               uplinkJobLog += logger.processLog('s',`DFX KILL ERROR - standard error:  ${dfxKill.stderr}`);
            }
          } // end if DEV or not
          // now we check for the webpack server

          if (fs.existsSync(`${WORKSPACE_DIR}/config/webpackPid`)) {

            var webpackPid ='';

            try {
              webpackPid = fs.readFileSync(`${WORKSPACE_DIR}/config/webpackPid`, 'utf8' ); // end read pid 
            } catch (err) {
              console.error(err)
            }

            uplinkJobLog += logger.processLog('s',`WEBPACK SERVICE FOUND - pid: ${webpackPid}`);
            const webpackKillPid = shell.exec (`kill ${webpackPid}`,  { silent: true, async: false });
            uplinkJobLog += logger.processLog('s',`WEBPACK SERVICE KILL PID - standard out: ${webpackKillPid.stdout}`);
  
            if (webpackKillPid.stderr) {
              uplinkJobLog += logger.processLog('s',`WEBPACK SERVICE KILL ERROR PID - standard error:  ${webpackKillPid.stderr}`);
            }
            // we are doing a killall as well just to make sure 
            //TODO: reevaluate whether this is necessary 
            
            const webpackKill = shell.exec (`killall webpack`,  { silent: true, async: false });
          
            uplinkJobLog += logger.processLog('s',`WEBPACK SERVICE KILL - standard out: ${webpackKill.stdout}`);
  
            if (webpackKill.stderr) {
              uplinkJobLog += logger.processLog('s',`WEBPACK SERVICE KILL ERROR - standard error:  ${webpackKill.stderr}`);
            }
            // now we check for the webpack server


          } //end if there is a webpackpid


          if (WORKER_MODE != "DEV") { 
            // if DEV we are actually using the same dfx server
            const dfxStop = shell.exec ('dfx stop',  { silent: true, async: false });
          
            uplinkJobLog += logger.processLog('s',`DFX STOP - standard out: ${dfxStop.stdout}`);
  
            if (dfxStop.stderr) {
              uplinkJobLog += logger.processLog('s',`DFX STOP ERROR - standard error:  ${dfxStop.stderr}`);
            }
            
          } // end if dev 
            
          
            
          console.log ('DIRECTORY Array.isArray: ', Array.isArray(lastRepoCloneUrl.match(/[^\/]+(?=\.[^\/.]*$)/)));
            // per git convention, repo clone directory should be everything between last slash and last dot in the repo url
            if (Array.isArray(lastRepoCloneUrl.match(/[^\/]+(?=\.[^\/.]*$)/))) {
              const lastDestinationFolderName = lastRepoCloneUrl.match(/[^\/]+(?=\.[^\/.]*$)/)[0]
              uplinkJobLog += logger.processLog('s','PROJECT DIRECTORY CHECK: '+ WORKSPACE_DIR+"/../deployments/"+lastDestinationFolderName );
              if (fs.existsSync(WORKSPACE_DIR+"/../deployments/"+lastDestinationFolderName)) {

                

                shell.cd(WORKSPACE_DIR);
                uplinkJobLog += logger.processLog('s','REMOVING LAST REPO - repo folder: '+WORKSPACE_DIR+"/../deployments/"+lastDestinationFolderName)

                fs.rmSync(WORKSPACE_DIR+"/../deployments/"+lastDestinationFolderName, { recursive: true, force: true });
                
              }; // end if exists  
              
              
            } else {
              uplinkJobLog += logger.processLog('e','ERROR WITH LAST DEPLOYMENT REPO')
              
            }// end if URL is good


          } // end if there is a deploymentObjectLocal from the last deployment


        // ************************************* 
        // Environment/Job assignments aligned, now transitioning now to Git workflow
        // *************************************

            /// ********* START LOG STATUS

            localTime = Date.now();
            console.log ("localTime: ",localTime) ;
            
            eventTypeLog = "Status" ;
            mainRefTypeLog = uplinkResponse.jobObject.jobType;
            environmentIdLog = uplinkResponse.deploymentObject.environmentId ;
            projectIdLog = uplinkResponse.deploymentObject.projectId;
            deploymentIdLog =uplinkResponse.deploymentObject.id ;
            workerIdLog = uplinkResponse.jobObject.workerId;
            jobIdLog = uplinkResponse.jobObject.id;
            eventTextLog = `DEPLOY - CLONING GIT REPOSITORY`;
            uplinkLogEvent(eventTypeLog, mainRefTypeLog, environmentIdLog, projectIdLog, deploymentIdLog, workerIdLog, jobIdLog, eventTextLog, localTime) ;

            /// ********* END LOG STATUS

        // we receive repo URLs from ICPM as straight cut/paste format (re the GH "Code" button).
        // so those will need to be chunked up for rearrangement in auth-tokenized fetch format.
        const repoUrlSections = new URL(uplinkResponse.deploymentObject.projectRepo)
        let repoCloneUrl = repoUrlSections.host + repoUrlSections.pathname
        uplinkJobLog += logger.processLog('s',`GIT CLONE VAR - set as: ${repoCloneUrl}.`)


        
        // per git convention, repo clone directory should be everything between last slash and last dot in the repo url
        if (Array.isArray(repoCloneUrl.match(/[^\/]+(?=\.[^\/.]*$)/))) {
          globalThis.cloneDestinationFolderName = repoCloneUrl.match(/[^\/]+(?=\.[^\/.]*$)/)[0]
          if (fs.existsSync(WORKSPACE_DIR+"/../deployments/"+cloneDestinationFolderName)) {
            uplinkJobLog += logger.processLog('s','WARNING - SHOULD NOT EXIST - REMOVING - repo folder '+cloneDestinationFolderName)

            fs.rmSync(WORKSPACE_DIR+"/../deployments/"+cloneDestinationFolderName, { recursive: true, force: true });
            
          }; // end if exists  
          
        } else {
          globalThis.cloneDestinationFolderName = 'projectHomeDir'
        }



          uplinkJobLog += logger.processLog('s',`GIT CLONE ${repoCloneUrl}` );
          // now we change directory into the deployments folder

          shell.cd(WORKSPACE_DIR+"/../deployments");
          // inject GH auth_token into request, execute authenticated clone request.
          const gitClone = spawnSync('git', ['clone', `https://${GITHUB_AUTH_TOKEN}@${repoCloneUrl}`], { encoding: 'utf-8' })
          // log stdio from git clone
          let gitCloneIo = gitClone.stdout + '\n' + gitClone.stderr
          fs.appendFileSync(gitLogFile, gitCloneIo)
          fs.appendFileSync(jobLogFile, gitCloneIo)
          uplinkJobLog += logger.processLog('s',`GIT CLONE RESULTS: ${gitCloneIo}` );

          // cd into new folder containing our cloned repo
          shell.cd(cloneDestinationFolderName)
          

          let gitCheckout = shell.exec(`git checkout ${uplinkResponse.deploymentObject.projectRepoBranch}`,  { silent: true, async: false })
          let gitCheckoutIo = gitCheckout.stdout + '\n' + gitCheckout.stderr
          if (gitCheckout.code == 0) {
            uplinkJobLog += logger.processLog('s',`GIT CHECKOUT - Git checkout complete for branch ${uplinkResponse.deploymentObject.projectRepoBranch}`)
          } else {
            uplinkJobLog += logger.processLog('e',`ERROR GIT CHECKOUT - Git checkout failed for ${uplinkResponse.deploymentObject.projectRepoBranch}`)
          }

          

          // confirm that Worker's active git branch aligns with ICPM instructions.
          // i think better to do this after (as opposed to during) checkout.
          let activeRepoBranch = shell.exec('git branch --show-current',  { silent: true, async: false })
          activeRepoBranch = activeRepoBranch.stdout.toString().trim()
          uplinkJobLog += logger.processLog('s',`GIT ACTIVE BRANCH -  branch ${activeRepoBranch}`)
  
          if (activeRepoBranch != uplinkResponse.deploymentObject.projectRepoBranch) {
            uplinkJobLog += logger.processLog('e',`ERROR GIT BRANCH - Current active repo branch ${activeRepoBranch} does not match ICPM repo branch ${uplinkResponse.deploymentObject.projectRepoBranch}`)
          } else {
            uplinkJobLog += logger.processLog('s',`GIT BRANCH - Current active repo branch ${activeRepoBranch} concurs with ICPM repo branch ${uplinkResponse.deploymentObject.projectRepoBranch}`)
          }
          
            /// ********* START LOG STATUS

            localTime = Date.now();
            console.log ("localTime: ",localTime) ;
            
            eventTypeLog = "Status" ;
            mainRefTypeLog = uplinkResponse.jobObject.jobType;
            environmentIdLog = uplinkResponse.deploymentObject.environmentId ;
            projectIdLog = uplinkResponse.deploymentObject.projectId;
            deploymentIdLog =uplinkResponse.deploymentObject.id ;
            workerIdLog = uplinkResponse.jobObject.workerId;
            jobIdLog = uplinkResponse.jobObject.id;
            eventTextLog = `DEPLOY - NPM INSTALL`;
            uplinkLogEvent(eventTypeLog, mainRefTypeLog, environmentIdLog, projectIdLog, deploymentIdLog, workerIdLog, jobIdLog, eventTextLog, localTime) ;

            /// ********* END LOG STATUS
            
          // run/log npm install
          const npmInstall = shell.exec ('npm install',  { silent: true, async: false })
          
          uplinkJobLog += logger.processLog('s',`NPM INSTALL - standard out: ${npmInstall.stdout}`)

          if (npmInstall.stderr) {
            uplinkJobLog += logger.processLog('s',`NPM INSTALL WARNING - standard error:  ${npmInstall.stderr}`)
          }
          


          // **************************************
          // ICPM housekeeping and Git activities in order, move to DFX workflow
          // **************************************

          // IS II ENABLED

          // if the worker is enabled for II then we need to start the replica for II and deploy the canister

          if (uplinkResponse.workerObject.iiEnabled == "Y" &&  (uplinkResponse.environmentObject.environmentType == "DEV" || uplinkResponse.environmentObject.environmentType == "QA"  )) {
            // so we change directory
            iiChangeDir = shell.cd (WORKSPACE_DIR+"/../internet-identity")
            let iiChangeDirIo = iiChangeDir.stdout + '\n' + iiChangeDir.stderr

            if ( iiChangeDir.stderr) {

              uplinkJobLog += await logger.processLog('e',`ERROR INTERNET IDENTITY - should be there but could not change directory - ${iiChangeDir.stderr}`) ;

              await endUplink(uplinkJobLog);
              shell.exit(0);

            } else {
              uplinkJobLog += logger.processLog('s','INTERNET IDENTITY - changed directory to internet-identity') ;
            } // end if we can change directort

          } // end if II enabled
          // before starting dfx commands, verify that a dfx.json file exists in the cloned repo directory.
          // this should be synchronous and complete before dfx looks for the file as mandatory.
          
          dfxConfigFile = `${WORKSPACE_DIR}/../deployments/${cloneDestinationFolderName}/dfx.json`;

          uplinkJobLog += logger.processLog('s',`DFX CHECK LOCATION - Location of required DFX config file: ${dfxConfigFile}`)

          if (!fs.existsSync(dfxConfigFile)) {

            uplinkJobLog += logger.processLog('e',`ERROR DFX CHECK CONFIG - System check did NOT detect required dfx.json file @${dfxConfigFile}`)
            return

          } else {

            uplinkJobLog += logger.processLog('s',`DFX CHECK - config file present and accounted for: ${dfxConfigFile}`)
            
            // then we open it parse it
              // now we open the json file from the deployment
              try {
                if (fs.existsSync(dfxConfigFile)) {
                  dfxJson = fs.readFileSync(dfxConfigFile, 'utf8' ); 
                }// end if exists
              } catch (err) {

                uplinkJobLog += logger.processLog('s',`ERROR - dfx.json: ${err}` ) ;

              }
              if (WORKER_MODE == "DEV") {
                console.log ("dfxJson",dfxJson );
              }

              dfxJsonObject = JSON.parse(dfxJson) ;


          } // end if dfx.json detected in root directory of cloned project
          
          // now we want to set up webpack to run HTTPS if its using it
          // TODO - make this a setting in the Environment
          
          var httpsWebpackActive = "" ;
          var packageJsonFileJson = "";

          // before starting dfx commands, verify that a dfx.json file exists in the cloned repo directory.
          // this should be synchronous and complete before dfx looks for the file as mandatory.
          const packageJsonFile = `${WORKSPACE_DIR}/../deployments/${cloneDestinationFolderName}/package.json`

          uplinkJobLog += logger.processLog('s',`PACKAGE JSON START to HTTPs- adding --https to webpack start if exists`)


          if (fs.existsSync(packageJsonFile)) {

            packageJsonFileJson = await require(packageJsonFile) ;

            const startSection = packageJsonFileJson["scripts"]["start"];

            console.log ("startSection: ", startSection);
            //if (startSection == "webpack serve --mode development --env development") {
              //as long as the substring is using webpack than we can add the parameter
              // TODO - make this a parameter of the environment default is to force https

            if (startSection.substr(0, 7) == "webpack") {
              httpsWebpackActive = ' -- --https --allowed-hosts all';
            } else {

              httpsWebpackActive = ' -- --allowed-hosts all';
            
            } // end if there is a start section and webpack
            


            uplinkJobLog += logger.processLog('s',`PACKAGE JSON START to HTTPs - config file present and accounted for: ${dfxConfigFile} (httpsWebpackActive: ${httpsWebpackActive})`)

          } else {

            uplinkJobLog += logger.processLog('e',`PACKAGE JSON START to HTTPs - System check did NOT detect required dfx.json file @${dfxConfigFile}`)

          } // end if packageJsonFile detected in root directory of cloned project
          
          

          var walletJsonFileJson = "";

          // so now we check for an identity
          if (uplinkResponse.identityObject.id > 0 )  {
            // then we have an identity and we need to use it
            // at the begining of the script we verified/created the icpipeline folder

            // need to grab the wallet ID for the ic.
            if (uplinkResponse.identityObject.profileWalletId != "" ) {
              // we need to build the wallets json object
              
              try {
               
                walletJsonFileJson += `{ "identities": { "icpipeline": { "ic": "${uplinkResponse.identityObject.profileWalletId}"} } }`;

              } catch (err) {
                
                uplinkJobLog += logger.processLog('s',`ERROR - profile wallets.json: ${err}` ) ;
              } 

            } // end if there is anything in wallets


            // then we need to write the two files 
            
            try {
               
            
              fs.writeFileSync(`${homeDirectory}/.config/dfx/identity/icpipeline/identity.pem`, `${uplinkResponse.identityObject.identityPem}`);
              fs.writeFileSync(`${homeDirectory}/.config/dfx/identity/icpipeline/wallets.json`, `${walletJsonFileJson}`);
  
            } catch (err) {
              
              uplinkJobLog += logger.processLog('s',`ERROR - writeFileSync identity/wallets.json: ${err}` ) ;
            } 
            // then we need to tell dfx to use that identity
            uplinkJobLog += logger.processLog('s',`DFX ICPIPELINE IDENTITY - wrote identity files to icpipeline identity folder for identity: ${uplinkResponse.identityObject.name} (${uplinkResponse.identityObject.id})`);

            dfxUse = shell.exec ('dfx identity use icpipeline',  { silent: true, async: false });
                
            uplinkJobLog += logger.processLog('s',`DFX USE ICPIPELINE - standard out: ${dfxUse.stdout}`);

            if (dfxUse.stderr) {
              uplinkJobLog += logger.processLog('s',`DFX USE ICPIPELINE WARNING/ERROR - standard error:  ${dfxUse.stderr}`);
            }

            // then we need to do a who am i for the log and if it matches set deployToNetwork = "ic"
            
            dfxWhoami = shell.exec ('dfx identity whoami',  { silent: true, async: false });
                
            uplinkJobLog += logger.processLog('s',`DFX WHOAMI - standard out: ${dfxWhoami.stdout}`);

            if (dfxWhoami.stderr) {
              uplinkJobLog += logger.processLog('s',`DFX USE WHOAMI WARNING/ERROR - standard error:  ${dfxWhoami.stderr}`);
            }
            // then we set the deployToNetwork 
            deployToNetwork = "ic";
            
          } else {
            // we may have had another deployment with a different identity so we have to go back to default
          
            dfxUse = shell.exec ('dfx identity use default',  { silent: true, async: false });
                
            uplinkJobLog += logger.processLog('s',`DFX USE DEFAULT - standard out: ${dfxUse.stdout}`);

            if (dfxUse.stderr) {
              uplinkJobLog += logger.processLog('s',`DFX USE DEFAULT WARNING/ERROR - standard error:  ${dfxUse.stderr}`);
            }

            // then we need to do a who am i for the log and if it matches set deployToNetwork = "ic"
            
            dfxWhoami = shell.exec ('dfx identity whoami',  { silent: true, async: false });
                
            uplinkJobLog += logger.processLog('s',`DFX WHOAMI - standard out: ${dfxWhoami.stdout}`);

            if (dfxWhoami.stderr) {
              uplinkJobLog += logger.processLog('s',`DFX USE WHOAMI WARNING/ERROR - standard error:  ${dfxWhoami.stderr}`);
            }
            deployToNetwork = "local";

          }// end if we have an identity


          // now we get the DFX file and parse

          var canisterJsonFileJson = "" ;


          // now we need to see if there was an canister profiles
          if (uplinkResponse.canisterProfiles.length > 0 ) { 
            // but we only create them if they exist in dfxjson ... otherwise fail the deployment

            
            uplinkJobLog += logger.processLog('s',`DFX CANISTER PROFILES - creating canister_ids.json`);

            //console.log ("uplinkResponse.canisterProfiles: ", uplinkResponse.canisterProfiles);

            // now we loop through the profiles and build the file
            for(var i in uplinkResponse.canisterProfiles) {    

              var thisProfile = uplinkResponse.canisterProfiles[i];   
          
              if (dfxJsonObject["canisters"][thisProfile.canisterName]) {
                
                //console.log ("thisProfile.canisterName: ", thisProfile.canisterName);
                //console.log ("thisProfile.canisterId: ", thisProfile.canisterId);
                if (canisterJsonFileJson != "" ) {
                  canisterJsonFileJson += ",";
                }
                canisterJsonFileJson += `"${thisProfile.canisterName}": { "${deployToNetwork}": "${thisProfile.canisterId}"}`;
              } else {
                uplinkJobLog += logger.processLog('e',`DFX CANISTER PROFILES ERROR - canisterName: ${thisProfile.canisterName} - does not exist in dfx.json`);

              } // end if there is record of this canister in the dfx json file

                
            } // end for through profiles

            if (canisterJsonFileJson != "" ) {

              canisterJsonFileJson = `{${canisterJsonFileJson}}`;
              // now we write the file
              fs.writeFileSync(`${WORKSPACE_DIR}/../deployments/${cloneDestinationFolderName}/canister_ids.json`, `${canisterJsonFileJson}`);

            } // end if there were canisters to put in the file ..


          } // end if there are canisterProfiles

          // we are going to exit now for TESTING 

          //console.log ("canisterJsonFileJson: ", canisterJsonFileJson);

          


          // execute DFX command sequence for standard build/deploy
          
          // want to stop it first for dfx server first
          
            /// ********* START LOG STATUS

            localTime = Date.now();
            console.log ("localTime: ",localTime) ;
            
            eventTypeLog = "Status" ;
            mainRefTypeLog = uplinkResponse.jobObject.jobType;
            environmentIdLog = uplinkResponse.deploymentObject.environmentId ;
            projectIdLog = uplinkResponse.deploymentObject.projectId;
            deploymentIdLog =uplinkResponse.deploymentObject.id ;
            workerIdLog = uplinkResponse.jobObject.workerId;
            jobIdLog = uplinkResponse.jobObject.id;

            if (uplinkResponse.workerObject.iiEnabled == "Y"  &&  (uplinkResponse.environmentObject.environmentType == "DEV" || uplinkResponse.environmentObject.environmentType == "QA"  ) ) {
              eventTextLog = `DEPLOY - STARTING DFX REPLICA - II VERSION`;
            } else {
              eventTextLog = `DEPLOY - STARTING DFX REPLICA`;
            }// end if iiEnabled

            uplinkLogEvent(eventTypeLog, mainRefTypeLog, environmentIdLog, projectIdLog, deploymentIdLog, workerIdLog, jobIdLog, eventTextLog, localTime) ;

            /// ********* END LOG STATUS
            
          // ******* INTERNET IDENTITY
          // TODO here we check to see if this is an internet identity project, 
          // if so we move to that directory and start DFX from there and then
          // come back here to check for the server
          // then after the server starts need to go back and deploy the II canister


          uplinkJobLog += logger.processLog('s',`DFX START SERVER`)
          dfxLogPipe = fs.openSync(`${WORKSPACE_DIR}/log/dfx.log`, 'a');
          
            if (WORKER_MODE == "DEV") {

              uplinkJobLog += logger.processLog('s',`WORKER_MODE=DEV - DFX START SERVER - Skipping starting the dfx server because we are on dev`)

              
            } else {
              let dfxReplicaTypeParam = "--emulator";

              if (uplinkResponse.workerObject.dfxReplicaType == "replica") {
                dfxReplicaTypeParam = "";

              }

                const dfxStart = spawn('dfx', ['start','--clean',dfxReplicaTypeParam,'--background'], {
                  stdio: ['ignore',dfxLogPipe,dfxLogPipe], 
                  detached:true
                });
              console.log ('DFX START')
              
              uplinkJobLog += logger.processLog('s',`DFX START - pid: ${dfxStart.pid}`)
                      
            }
          
          uplinkJobLog += logger.processLog('s',`DFX DEPLOY BEGIN - SPAWNED ASYNC - Waiting for replica to launch`);          
          // now we check for the dfxserver
          checkWebServiceId = setInterval( function() {

            http.get('http://localhost:8000/api/v2/status', function (res) {
              // If you get here, you have a response.
              
              console.log ('the dfx replica is up');
              //console.log (res);
              //console.log ('that was the res');
              if (res.statusCode == 200 ) {
                // stop the interval

                /// ********* START LOG STATUS

                localTime = Date.now();
                console.log ("localTime: ",localTime) ;
                
                eventTypeLog = "Status" ;
                mainRefTypeLog = uplinkResponse.jobObject.jobType;
                environmentIdLog = uplinkResponse.deploymentObject.environmentId ;
                projectIdLog = uplinkResponse.deploymentObject.projectId;
                deploymentIdLog =uplinkResponse.deploymentObject.id ;
                workerIdLog = uplinkResponse.jobObject.workerId;
                jobIdLog = uplinkResponse.jobObject.id;
                if ( uplinkResponse.workerObject.iiEnabled == "Y" &&  (uplinkResponse.environmentObject.environmentType == "DEV" || uplinkResponse.environmentObject.environmentType == "QA"  ) ) {
                  eventTextLog = `DEPLOY - DFX DEPLOY INITIATED - II VERSION`;
                } else {
                  eventTextLog = `DEPLOY - DFX DEPLOY INITIATED`;
                }
                uplinkLogEvent(eventTypeLog, mainRefTypeLog, environmentIdLog, projectIdLog, deploymentIdLog, workerIdLog, jobIdLog, eventTextLog, localTime) ;

                /// ********* END LOG STATUS
                let dfxDeploy ;
                // now we check for iiEnabled
                if ( uplinkResponse.workerObject.iiEnabled == "Y"  &&  (uplinkResponse.environmentObject.environmentType == "DEV" || uplinkResponse.environmentObject.environmentType == "QA"  )) {
                  // also assumes we are in the internet-identity folder
                  uplinkJobLog += logger.processLog('s',`DFX DEPLOY START - II VERSION`);

                  dfxDeploy = shell.exec ("II_ENV=development dfx deploy --no-wallet --argument '(null)'",  { silent: true, async: false });
                      
                  uplinkJobLog += logger.processLog('s',`DFX DEPLOY COMPLETE - II VERSION - standard out: ${dfxDeploy.stdout}`);

                  if (dfxDeploy.stderr) {
                    uplinkJobLog += logger.processLog('s',`DFX DEPLOY WARNING/ERROR - II VERSION - standard error:  ${dfxDeploy.stderr}`);
                  }

                  

                } else {
                  
                  // then this is a regular dfx deploy

                  uplinkJobLog += logger.processLog('s',`DFX DEPLOY START - deployToNetwork: ${deployToNetwork}`);

                  dfxDeploy = shell.exec (`dfx deploy  --network=${deployToNetwork}`,  { silent: true, async: false });
                      
                  uplinkJobLog += logger.processLog('s',`DFX DEPLOY COMPLETE - standard out: ${dfxDeploy.stdout}`);

                  if (dfxDeploy.stderr) {
                    uplinkJobLog += logger.processLog('s',`DFX DEPLOY WARNING/ERROR - standard error:  ${dfxDeploy.stderr}`);
                  }

                } //end if II
                
                if (dfxDeploy.stderr.includes ('Http Error: status 503') || dfxDeploy.stderr.includes ('The status response did not contain a root key.') ) {
                  
                  // the replica is not ready yet

                  uplinkJobLog += logger.processLog('s',`DFX DEPLOY WAIT/RETRY - could not deploy yet, replica service is still launching`)

                } else {

                // now if we have the iiEnabled we need to do the deploy for the project
                if ( uplinkResponse.workerObject.iiEnabled == "Y"  &&  (uplinkResponse.environmentObject.environmentType == "DEV" || uplinkResponse.environmentObject.environmentType == "QA"  ) ) {

                    /// ********* START LOG STATUS

                    localTime = Date.now();
                    console.log ("localTime: ",localTime) ;
                    
                    eventTypeLog = "Status" ;
                    mainRefTypeLog = uplinkResponse.jobObject.jobType;
                    environmentIdLog = uplinkResponse.deploymentObject.environmentId ;
                    projectIdLog = uplinkResponse.deploymentObject.projectId;
                    deploymentIdLog =uplinkResponse.deploymentObject.id ;
                    workerIdLog = uplinkResponse.jobObject.workerId;
                    jobIdLog = uplinkResponse.jobObject.id;
                    // because we know there was an other deploy for the II
                    eventTextLog = `DEPLOY - DFX DEPLOY INITIATED - PROJECT`;
                    uplinkLogEvent(eventTypeLog, mainRefTypeLog, environmentIdLog, projectIdLog, deploymentIdLog, workerIdLog, jobIdLog, eventTextLog, localTime) ;

                    shell.cd(WORKSPACE_DIR+"/../deployments");
                    // cd into new folder containing our cloned repo
                    shell.cd(cloneDestinationFolderName)
                    // then this is a regular dfx deploy
  
                    uplinkJobLog += logger.processLog('s',`DFX DEPLOY START - PROJECT`);
  
                    const dfxDeploy = shell.exec (`dfx deploy`,  { silent: true, async: false });
                        
                    uplinkJobLog += logger.processLog('s',`DFX DEPLOY COMPLETE - PROJECT - standard out: ${dfxDeploy.stdout}`);
  
                    if (dfxDeploy.stderr) {
                      uplinkJobLog += logger.processLog('s',`DFX DEPLOY WARNING/ERROR - PROJECT - standard error:  ${dfxDeploy.stderr}`);
                    }
  


                } // end if this is an ii enabled worker
                    

                // now we launch the webpack server


                  // now we turn on the internet Identity webpack if iiEnabled is enabled.


                  /// ********* START LOG STATUS

                  localTime = Date.now();
                  console.log ("localTime: ",localTime) ;
                  
                  eventTypeLog = "Status" ;
                  mainRefTypeLog = uplinkResponse.jobObject.jobType;
                  environmentIdLog = uplinkResponse.deploymentObject.environmentId ;
                  projectIdLog = uplinkResponse.deploymentObject.projectId;
                  deploymentIdLog =uplinkResponse.deploymentObject.id ;
                  workerIdLog = uplinkResponse.jobObject.workerId;
                  jobIdLog = uplinkResponse.jobObject.id;
                  eventTextLog = `DEPLOY - STARTING WEBPACK DEV SERVER`;
                  uplinkLogEvent(eventTypeLog, mainRefTypeLog, environmentIdLog, projectIdLog, deploymentIdLog, workerIdLog, jobIdLog, eventTextLog,localTime) ;

                  /// ********* END LOG STATUS
                  clearInterval (checkWebServiceId);
                  uplinkJobLog += logger.processLog('s',`WEBPACK START SERVER`);
                  
                  fs.appendFile(`${WORKSPACE_DIR}/log/webpack.log`, new Date().toISOString() + ' : ******* START WEBPACK DEV SERVER *******', function (err) {
                    if (err) throw err;
                    //console.log('Saved!');
                  }); // end start new log section 

                  const webpackLogPipe = fs.openSync(`${WORKSPACE_DIR}/log/webpack.log`, 'a');
                  const webpackservice = spawn('npm', ['run','start', httpsWebpackActive], {
                    stdio: ['ignore',webpackLogPipe,webpackLogPipe],
                    detached: true,
                    shell: true
                  });

                  
                  
                  uplinkJobLog += logger.processLog('s',`NPM RUN START - pid = ${webpackservice.pid} (httpsWebpackActive:${httpsWebpackActive})`)
                  
                  // now we need to write this pid to a file so we can kill it
                  fs.writeFileSync(`${WORKSPACE_DIR}/config/webpackPid`, `${webpackservice.pid}`);
                  

                  uplinkJobLog += logger.processLog('s',`WROTE WEBPACK DEVSERVER PID (${webpackservice.pid}) TO FILE` ) ;


                  webpackservice.unref();

                  // now if II is enabled then we want to start webpack on 8090 for it 
                  if ( uplinkResponse.workerObject.iiEnabled == "Y"  &&  (uplinkResponse.environmentObject.environmentType == "DEV" || uplinkResponse.environmentObject.environmentType == "QA"  )) {
                        

                      shell.cd(WORKSPACE_DIR+"/../internet-identity");
                      uplinkJobLog += logger.processLog('s',`II WEBPACK START SERVER`);
                      
                      fs.appendFile(`${WORKSPACE_DIR}/log/webpack.log`, new Date().toISOString() + ' : ******* START WEBPACK DEV SERVER *******', function (err) {
                        if (err) throw err;
                        //console.log('Saved!');
                      }); // end start new log section 

                      const webpackLogPipe = fs.openSync(`${WORKSPACE_DIR}/log/webpack.log`, 'a');
                      const webpackserviceII = spawn('npm', ['run','start', '-- --https --port 8090 --allowed-hosts all'], {
                        stdio: ['ignore',webpackLogPipe,webpackLogPipe],
                        detached: true,
                        shell: true
                      });

                      
                      
                      uplinkJobLog += logger.processLog('s',`II NPM RUN START - pid = ${webpackserviceII.pid} (httpsWebpackActive:${httpsWebpackActive})`)
                      
                      // now we need to write this pid to a file so we can kill it
                      fs.writeFileSync(`${WORKSPACE_DIR}/config/webpackIIPid`, `${webpackserviceII.pid}`);
                      

                      uplinkJobLog += logger.processLog('s',`II WROTE WEBPACK DEVSERVER PID (${webpackserviceII.pid}) TO FILE` ) ;


                      webpackserviceII.unref();


                  } // end if iiEnabled

                  
                  /// now that we got this far we should check for and log all of the canisters
                  uplinkJobLog += logger.processLog('s',`CHECKING FOR CANISTERS` ) ;

                  // first we create the array we will loop through
                  const defaultDeploymentFolder = `${WORKSPACE_DIR}/../deployments/${cloneDestinationFolderName}`;

                  var deploymentFolders = [defaultDeploymentFolder];

                  if ( uplinkResponse.workerObject.iiEnabled == "Y"  &&  (uplinkResponse.environmentObject.environmentType == "DEV" || uplinkResponse.environmentObject.environmentType == "QA"  )) {
                    const iiDeploymentFolder = `${WORKSPACE_DIR}/../internet-identity`;
                    deploymentFolders.push (iiDeploymentFolder);

                  } // end if this included a iiDeployment

                  for (let i = 0; i < deploymentFolders.length; i++) {

                  // now we get the canisters.json from the dfx deployment

                  var deployedCanisterCategory="deployment";
                  var deployedCanisterDescription="Created by the deployment process.";
                  var deployedDfxJson = "";
                  var deployedCanisterName = "";
                  var deployedCanisterNetwork = "";
                  var deployedCanisterId = "" ;
                  var identityId = 0 ;
                  
                  var dfxCanisterJson = "";
                  var dfxJson = "";
                  
                  
                  // now we open the json file from the deployment
                  try {
                    if (fs.existsSync(`${deploymentFolders[i]}/dfx.json`)) {
                      dfxJson = fs.readFileSync(`${deploymentFolders[i]}/dfx.json`, 'utf8' ); 
                    }// end if exists
                  } catch (err) {

                    uplinkJobLog += logger.processLog('s',`ERROR - dfx.json: ${err}` ) ;

                  }
                  if (WORKER_MODE == "DEV") {
                    console.log ("dfxJson",dfxJson );
                  }
  
                  const dfxJsonObject = JSON.parse(dfxJson) ;
                  
                  
                    // now we open the json file from the deployment
                    if (deployToNetwork == "ic" ) {
                      // then an internet computer
                      try {
                        if (fs.existsSync(`${deploymentFolders[i]}/canister_ids.json`)) {
                          dfxCanisterJson = fs.readFileSync(`${deploymentFolders[i]}/canister_ids.json`, 'utf8' ); 
                        }// end if exists
                      } catch (err) {

                        uplinkJobLog += logger.processLog('s',`ERROR - ic canister_ids.json: ${err}` ) ;

                      }
                      if (WORKER_MODE == "DEV") {
                        console.log ("dfxCanisterJsonIC : ",dfxCanisterJson );
                        console.log ("dfxCanisterJsonICPATH : ",`${deploymentFolders[i]}/canister_ids.json` );
                      } // end if dev

                    } else {
                      // then its local 
                      try {
                        if (fs.existsSync(`${deploymentFolders[i]}/.dfx/local/canister_ids.json`)) {
                          dfxCanisterJson = fs.readFileSync(`${deploymentFolders[i]}/.dfx/local/canister_ids.json`, 'utf8' ); 
                        }// end if exists
                      } catch (err) {
                        
                        uplinkJobLog += logger.processLog('s',`ERROR - local canister_ids.json: ${err}` ) ;
                      } 
                      if (WORKER_MODE == "DEV") {
                        console.log ("dfxCanisterJsonLOCAL : ",dfxCanisterJson );
                      } // end if dev 
                    }
                    //console.log ("dfxCanisterJson: ", dfxCanisterJson)
                  
                    // now we check to see if there is a file
                    if (dfxCanisterJson != "" ) {
                          

                        const canistersObject = JSON.parse(dfxCanisterJson) ;
                      
                        for(var key in canistersObject) {
                          console.log("deployedCanisterName:" ,key);
                          for (var key1 in canistersObject[key]) {
                      
                            console.log("deployedCanisterNetwork:" ,key1);
                      
                            console.log("deployedCanisterId: ",canistersObject[key][key1]);
                      
                            deployedCanisterName = key;
                            deployedCanisterNetwork = key1;
                            deployedCanisterId = canistersObject[key][key1] ;
                            // now we check the name as the "__Candid_UI" canister will not be in the dfxjson
                            if (deployedCanisterName == "__Candid_UI" ) {
                              deployedCanisterType = "candid_ui" ;
                              deployedDfxJson = "";
                            } else {
                              deployedCanisterType = dfxJsonObject["canisters"][deployedCanisterName]["type"] ;
                              deployedDfxJson = JSON.stringify(dfxJsonObject["canisters"][deployedCanisterName] );
                            }
                            
                      
                            logCanister ( 
                              deployedCanisterCategory, 
                              deployedCanisterDescription, 
                              deployedDfxJson, 
                              deployedCanisterName, 
                              deployedCanisterType, 
                              deployedCanisterNetwork, 
                              deployedCanisterId,  
                              identityId, 
                              uplinkResponse.deploymentObject.projectId,
                              uplinkResponse.deploymentObject.environmentId,
                              uplinkResponse.deploymentObject.id );
                          } // end for through second set of keys
                      }// end for though first set of keys. 
                    } else {
                      // then there is not a canister json to read ... something went wrong
                      uplinkJobLog += logger.processLog('s',`ERROR NO CANISTERS - deployToNetwork: ${deployToNetwork} there is no contents in the canister_ids.json file to parse` ) ;

                    }// end if there is a dfxjson file
                
                  }// end for through deploymentFolders


                  ///// SUCCESS >>> END OF DEPLOYMENT


                  // now we send all of the jobLog to the ICPM

                  endUplink(uplinkJobLog);

                } // then we got a deployment to start 

            } // end if status == 200


            }).on('error', function(e) {
              // Here, an error occurred.  Check `e` for the error.
              console.log ('the dfx replica is down ');
              console.log (e);
              console.log ("down - printed error");
            });
            
          }, 1000);
          
          


        } // end if ICPM response status code Green and deployment status Ready

        // add the job log to the full log

        // if we got this far then we have a successful deployment and will overright the Local file
          // write config updates to workerObjectLocal.json
          
          fs.writeFileSync(`${WORKSPACE_DIR}/config/deploymentObjectLocal.json`, JSON.stringify (uplinkResponse.deploymentObject, (key, value) =>
          typeof value === 'bigint'
              ? Number(value)
              : value // return everything else unchanged
          , 2));
          
          deploymentObjectLocal = uplinkResponse.deploymentObject ;

          uplinkJobLog += logger.processLog('s','WRITING DEPLOYMENT OBJECT TO FILE - updated deploymentObjectLocal with response deployment' ) ;

        // **********************************************************
        // **********************************************************
        // ********************* END Deployment   *******************
        // **********************************************************
        // **********************************************************

      } else if (uplinkResponse.jobObject.jobType == 'Install II' && uplinkResponse.jobObject.refType == "Worker"  && uplinkResponse.jobObject.refId == workerObjectLocal.id) {

        // **********************************************************
        // **********************************************************
        // ********************* BEGIN Install II *******************
        // **********************************************************
        // **********************************************************

        uplinkJobLog += logger.processLog('s','ICPM INSTALL II - we need to download and unpack the Internet Identity for this Worker' ) ;
        // change directory to above the uplink directory
        shell.cd(WORKSPACE_DIR+"/../");
        // now we download the tar

        uplinkJobLog += logger.processLog('s','ICPM INSTALL II - WGET - get compiled archive from icpipeline.com' ) ;
        let installIiShellWget = shell.exec(`wget -nv https://icpipeline.com/framework/iiarchive.tgz`,  { silent: true, async: false })
        
        let installIiShellWgetIo = installIiShellWget.stdout + '\n' + installIiShellWget.stderr
        
          if (installIiShellWget.code == 0) {
            
            uplinkJobLog += logger.processLog('s',`INSTALL II - WGET - Complete`)

            uplinkJobLog += logger.processLog('s',`INSTALL II - WGET RESULTS: ${installIiShellWgetIo}` );

            // now we unpack the tar since the wget worked

            let installIiShellTar = shell.exec(`tar -xf iiarchive.tgz`,  { silent: true, async: false })
            
            let installIiShellTarIo = installIiShellTar.stdout + '\n' + installIiShellTar.stderr
            
              if (installIiShellTar.code == 0) {
                uplinkJobLog += logger.processLog('s',`INSTALL II - TAR - Complete Extracted`)
                uplinkJobLog += logger.processLog('s',`INSTALL II - TAR RESULTS: ${installIiShellTarIo}` );


                let installIiShellRm = shell.exec(`rm iiarchive.tgz`,  { silent: true, async: false })
            
                let installIiShellRmIo = installIiShellRm.stdout + '\n' + installIiShellRm.stderr
                
                  if (installIiShellRm.code == 0) {
                    
                    uplinkJobLog += logger.processLog('s',`INSTALL II - RM TAR - Complete Removal of Tar`)
                    uplinkJobLog += logger.processLog('s',`INSTALL II - RM TAR RESULTS: ${installIiShellRmIo}` );
                    // TODO: So now we we want to do the initial deployment which takes a bit

                    shell.cd(WORKSPACE_DIR+"/../internet-identity/");



                    uplinkJobLog += logger.processLog('s',`INSTALL II - GIT PULL - get the latest master build from dfinity`);

                    let iiGitPull = shell.exec(`git pull`,  { silent: true, async: false })
                
                    let iiGitPullIo = iiGitPull.stdout + '\n' + iiGitPull.stderr
                    
                      if (iiGitPull.code == 0) {
                        
                        uplinkJobLog += logger.processLog('s',`INSTALL II - GIT PULL RESULTS: ${iiGitPullIo}` );
                        


                        let iiDfxBuild = shell.exec(`dfx build`,  { silent: true, async: false })
                    
                        let iiDfxBuildIo = iiDfxBuild.stdout + '\n' + iiDfxBuild.stderr
                        
                          if (iiDfxBuild.code == 0) {
                            
                            uplinkJobLog += logger.processLog('s',`INSTALL II - DFX BUILD - execute dfx build for first run and downloads`)
                            uplinkJobLog += logger.processLog('s',`INSTALL II - DFX BUILD RESULTS: ${iiDfxBuildIo}` );
                            
                            
                          } else {
                            
                            uplinkJobLog += logger.processLog('e',`ERROR INSTALL II - DFX BUILD - the command failed, check the logs`)
                            uplinkJobLog += logger.processLog('s',`INSTALL II - DFX BUILD RESULTS: ${iiDfxBuildIo}` );
                          }// end if iiDfxBuild
                        
                      } else {
                        
                        uplinkJobLog += logger.processLog('e',`ERROR INSTALL II - GIT PULL FAILED - the command failed, check the logs`)
                        uplinkJobLog += logger.processLog('s',`INSTALL II - GIT PULL RESULTS: ${iiGitPullIo}` );
                      }// end if iiDfxBuild
                      

                  } else {
                    
                    uplinkJobLog += logger.processLog('e',`ERROR INSTALL II - RM TAR - the command failed, check the logs`)
                    uplinkJobLog += logger.processLog('s',`INSTALL II - RM TAR RESULTS: ${installIiShellRmIo}` );
                  } // end if installIiShellRm

              } else {
                
                uplinkJobLog += logger.processLog('e',`ERROR INSTALL II TAR - the command failed, check the logs`)
                uplinkJobLog += logger.processLog('s',`INSTALL II TAR RESULTS: ${installIiShellTarIo}` );
              } // end if installIiShellTar
              
              


            
          } else {
            
            uplinkJobLog += logger.processLog('e',`ERROR INSTALL II WGET - wget failed ${uplinkResponse.deploymentObject.projectRepoBranch}`)
            uplinkJobLog += logger.processLog('s',`INSTALL II WGET RESULTS: ${installIiShellWgetIo}` );

          }// end if installIiShellWget


          ///// SUCCESS >>> END OF II INSTALL
        
        uplinkJobLog += logger.processLog('s','ICPM INSTALL II - Complete' ) ;
        endUplink (uplinkJobLog);
        
        // **********************************************************
        // **********************************************************
        // ********************* END Install II *********************
        // **********************************************************
        // **********************************************************

      } else if (uplinkResponse.jobObject.jobType == 'Enable ttyd Bash HTTPS' && uplinkResponse.jobObject.refType == "Worker"  && uplinkResponse.jobObject.refId == workerObjectLocal.id) {

        // **********************************************************
        // **********************************************************
        // ********************* BEGIN Enable TTyd HTTPS ************
        // **********************************************************
        // **********************************************************

        uplinkJobLog += logger.processLog('s','ICPM ENABLE TTYD - execute the start of the deamon and record its PID' ) ;
        // change directory to above the uplink directory (which would be the users home directory)
        shell.cd(WORKSPACE_DIR+"/../");
        // now we download the tar

        // now we are going to assume that the software was already installed into the docker, as well as the keys created ... 

        //ttyd  -p 65000 --ssl --ssl-cert /home/icpipeline/cert/certificate.crt --ssl-key /home/icpipeline/cert/private.key -t fontSize=20 -t 'theme={"background":"#003a74", "color":"#ffffff"}' bash

        uplinkJobLog += logger.processLog('s','ICPM ENABLE TTYD -  start the service and the log and record the pid' ) ;

        const ttydLogPipe = fs.openSync(`${WORKSPACE_DIR}/log/ttyd.log`, 'a');
        let ttydService ;

        if (fs.existsSync(`${WORKSPACE_DIR}/config/ttydServicePid`)) {

          var ttydServicePid ='';

          try {
            ttydServicePid = fs.readFileSync(`${WORKSPACE_DIR}/config/ttydServicePid`, 'utf8' ); // end read pid 
          } catch (err) {
            console.error(err)
          }
          uplinkJobLog += logger.processLog('s',`ERROR: ENABLE TTYD  -  there is a  pid file already (${ttydServicePid})` ) ;
          uplinkJobLog += logger.processLog('e',`ENABLE TTYD FAILED -  remove pid file and kill the service (${ttydServicePid}), or execute a Disable job` ) ;
        
        } else {
            
          if (WORKER_MODE == "DEV" ) { 
              ttydService = spawn('ttyd', ['-p 65000',
                                        'bash' ], {
                stdio: ['ignore',ttydLogPipe,ttydLogPipe],
                detached: true,
                shell: true
              });
            } else {
              ttydService = spawn('ttyd', ['-p 65000',
                                        '--ssl', 
                                        '--ssl-cert /home/icpipeline/cert/certificate.crt', 
                                        '--ssl-key /home/icpipeline/cert/private.key',
                                        '-t fontSize=20' ,
                                        '-t \'theme={"background":"#022440", "color":"#ffffff"}\'',
                                        'bash' ], {
                stdio: ['ignore',ttydLogPipe,ttydLogPipe],
                detached: true,
                shell: true
              });
              
            }
            
            
            uplinkJobLog += logger.processLog('s',`ENABLE TTYD HTTPS Service - Started (pid = ${ttydService.pid})`)
            
            // now we need to write this pid to a file so we can kill it
            fs.writeFileSync(`${WORKSPACE_DIR}/config/ttydServicePid`, `${ttydService.pid}`);
            
            

            uplinkJobLog += logger.processLog('s',`WROTE TTYD HTTPS SERVICE PID (${ttydService.pid}) TO FILE` ) ;


            ttydService.unref();
          } // end if there is already a PID 





          ///// SUCCESS >>> END OF Enable TTyd HTTPS
        
        uplinkJobLog += logger.processLog('s','ICPM ENABLE TTYD - Complete' ) ;
        endUplink (uplinkJobLog);
        


        // **********************************************************
        // **********************************************************
        // ********************* END Enable TTyd HTTPS **************
        // **********************************************************
        // **********************************************************

      } else if (uplinkResponse.jobObject.jobType == 'Disable ttyd Bash HTTPS' && uplinkResponse.jobObject.refType == "Worker"  && uplinkResponse.jobObject.refId == workerObjectLocal.id) {

        // **********************************************************
        // **********************************************************
        // ********************* BEGIN Disable TTyd HTTPS ************
        // **********************************************************
        // **********************************************************

        uplinkJobLog += logger.processLog('s','ICPM DISABLE TTYD - execute the kill of the deamon and record any output' ) ;
        // change directory to above the uplink directory (which would be the users home directory)
        shell.cd(WORKSPACE_DIR+"/../");
        // now we download the tar

        // now we are going to assume that the software was already installed into the docker, as well as the keys created ... 

        //ttyd  -p 65000 --ssl --ssl-cert /home/icpipeline/cert/certificate.crt --ssl-key /home/icpipeline/cert/private.key -t fontSize=20 -t 'theme={"background":"#003a74", "color":"#ffffff"}' bash


        
        
        // now we need to write this pid to a file so we can kill it
        
        if (fs.existsSync(`${WORKSPACE_DIR}/config/ttydServicePid`)) {

          var ttydServicePid ='';

          try {
            ttydServicePid = fs.readFileSync(`${WORKSPACE_DIR}/config/ttydServicePid`, 'utf8' ); // end read pid 
          } catch (err) {
            console.error(err)
          }

          uplinkJobLog += logger.processLog('s',`DISABLE TTYD - SERVICE FOUND - pid: ${ttydServicePid}`);
          const ttydKillPid = shell.exec (`kill ${ttydServicePid}`,  { silent: true, async: false });

          if (ttydKillPid.stderr) {
            uplinkJobLog += logger.processLog('e',`DISABLE TTYD - SERVICE KILL ERROR PID - standard error:  ${ttydKillPid.stderr}`);
          } else {

            uplinkJobLog += logger.processLog('e',`DISABLE TTYD - SUCCESS - removing pid file`);
            try {
              fs.unlinkSync (`${WORKSPACE_DIR}/config/ttydServicePid`);
            } catch (err) {
              console.error(err)
            }
          }

        } else {
          
          uplinkJobLog += logger.processLog('s',`TTYD SERVICE KILL ERROR there was no PID file (config/ttydServicePid)`);

        } //end if there is a ttydServicePid
        







          ///// SUCCESS >>> END OF Disable TTyd HTTPS
        
        uplinkJobLog += logger.processLog('s','ICPM DISABLE TTYD- Complete' ) ;
        endUplink (uplinkJobLog);
        


        // **********************************************************
        // **********************************************************
        // ********************* END Disable TTyd HTTPS **************
        // **********************************************************
        // **********************************************************

                
                

      } else {

        console.log ("unknown job type: ", uplinkResponse.jobObject.jobType);
        return;

      } // end if jobType == Deploy and jobId > 0 and jobRefId = deploymentId

    
    } else {

      uplinkJobLog += logger.processLog('s',`ICMP UPLINK CONCLUSION - Worker ${workerObjectLocal.id} is assigned to Environment ${uplinkResponse.environmentObject.name} (${uplinkResponse.environmentObject.id}) but does not have any Jobs at the moment`)
      isRunning = false;

    } // end if job ID > 0

    uplinkLog += uplinkJobLog;
    

  } else {

   logger.syslog(`No Environment assignment for Worker ${workerObjectLocal.id} on this Uplink.`)

   if (uplinkResponse.environmentObject.id <= 0) {
     logger.syslog(`Worker remains unassigned to an Environment by ICMP ${canisterId}`)
   }
   isRunning = false;
  }// END if/else environmentid > 0

   return true

  }// end if there is an error is the ICPM conversation

} // end function uplink()

// execute

const endUplink = async (uplinkJobLog) => {

  

  uplinkLog += logger.processLog('s',`ICMP UPLINK END`)

  if (uplinkJobLog && jobLogFile ) {

    localTime = Date.now();
    console.log ("localTime: ",localTime) ;
    
    fs.writeFileSync(jobLogFile, uplinkJobLog ) 
    eventTypeLog = "Log" ;
    mainRefTypeLog = uplinkResponse.jobObject.jobType ;
    environmentIdLog = uplinkResponse.deploymentObject.environmentId ;
    projectIdLog = uplinkResponse.deploymentObject.projectId;
    deploymentIdLog =uplinkResponse.deploymentObject.id ;
    workerIdLog = uplinkResponse.jobObject.workerId;
    jobIdLog = uplinkResponse.jobObject.id;
    eventTextLog = uplinkJobLog;
    uplinkLogEvent(eventTypeLog, mainRefTypeLog, environmentIdLog, projectIdLog, deploymentIdLog, workerIdLog, jobIdLog, eventTextLog, localTime) ;
    // we want to wait a half second to get the log to come in after 
    await sleep(500);

    eventTypeLog = "Status" ;
    mainRefTypeLog = uplinkResponse.jobObject.jobType ;
    environmentIdLog = uplinkResponse.deploymentObject.environmentId ;
    projectIdLog = uplinkResponse.deploymentObject.projectId;
    deploymentIdLog =uplinkResponse.deploymentObject.id ;
    workerIdLog = uplinkResponse.jobObject.workerId;
    jobIdLog = uplinkResponse.jobObject.id;
    eventTextLog = `JOB END`;
    uplinkLogEvent(eventTypeLog, mainRefTypeLog, environmentIdLog, projectIdLog, deploymentIdLog, workerIdLog, jobIdLog, eventTextLog,localTime) ;

  }
  
  
  //console.log (uplinkLog);
  console.log ("EOL");
  isRunning = false;


}// end endUplink

// now we create a function to send a log to the ICPM
const uplinkLogEvent = async (eventType, mainRefType, environmentId, projectId, deploymentId, workerId, jobId, eventText, localTime) => {


  localTimeNS = localTime *1000000;

  const thisEvent = {
    id: 0,
    eventType: eventType,
    mainRefType: mainRefType,  // Environment, Project, Deployment, Worker, App
    environmentId :environmentId ,
    projectId :projectId ,
    deploymentId :deploymentId ,
    workerId :workerId ,
    jobId :jobId ,
    eventText: eventText,
    localTime: localTimeNS,
    creatorId: 0,
    dateCreated: 0,
    lastUpdated: 0
  };


  uplinkLog += logger.processLog('s',`ICPM EVENT LOG START - about to call ICPM `)

  let uplinkManageEventMain = await actor.manageEventMain(ICPM_AUTH_TOKEN, thisEvent).catch(e => { return "ICPM Error: " + e })
    
  let uplinkManageEventMainString = JSON.stringify (uplinkManageEventMain, (key, value) =>
    typeof value === 'bigint'
        ? Number(value)
        : value // return everything else unchanged
    , 2);

if (uplinkManageEventMainString.includes('ICPM Error')) {

  uplinkLog += logger.processLog('e',`ICPM EVENT LOG ERROR - ${canisterId} - Error Response: ${uplinkManageEventMainString}`)

} else {
  //TODO Check for errors from the event write in msg 

  uplinkLog += logger.processLog('s',`ICPM EVENT LOG SENT - confirmation received from ICPM.`)

}

} // end uplinkLogEvent

// now we create a function to send a canister to the ICPM
const logCanister = async ( 
  deployedCanisterCategory, 
  deployedCanisterDescription, 
  deployedDfxJson, 
  deployedCanisterName,
  deployedCanisterType, 
  deployedCanisterNetwork, 
  deployedCanisterId, 
  identityId, 
  projectId,
  environmentId,
  thisDeploymentId) => {


  localTimeNS = localTime *1000000;

  const thisCanister = {
    id: 0,
    name: deployedCanisterName,
    category: deployedCanisterCategory,
    description: deployedCanisterDescription,
    dfxJson: deployedDfxJson,
    canisterName: deployedCanisterName,
    canisterType: deployedCanisterType,
    canisterNetwork: deployedCanisterNetwork,
    canisterId: deployedCanisterId,
    identityId: identityId,
    projectId: projectId,
    environmentId: environmentId,
    lastDeploymentId: thisDeploymentId,
    creatorId: 0,
    dateCreated: 0,
    lastUpdated: 0,
  } // end theCanisterObject


  
  let logCanisterMain = await actor.manageCanisterMain(ICPM_AUTH_TOKEN, thisCanister).catch(e => { return "ICPM Error: " + e })

  let logCanisterMainString = JSON.stringify (logCanisterMain, (key, value) =>
      typeof value === 'bigint'
      ? Number(value)
      : value // return everything else unchanged
      , 2);

  if (logCanisterMainString.includes('ICPM Error')) {

    uplinkLog += logger.processLog('e',`ICPM LOG CANISTER ERROR - ${canisterId} - Error Response: ${logCanisterMain}`)

  } else {
  //TODO Check for errors from the logCansiterMain write in msg 

    uplinkLog += logger.processLog('s',`ICPM LOG CANISTER SENT - confirmation received from ICPM.`)

  }

} // end logCanister


var isRunning = false ;

const uplinkInterval = setInterval( function() {

  if (isRunning == false ) {
    isRunning = true ;
    uplink().then(canisterOutput => {

      if (haveDeployment) {

        uplinkLog += logger.processLog('s',`AWAITING DEPLOYMENT COMPLETION`)

      } else {

        endUplink();
        
      } // end if doing a deployment 
      // now we allow the function to run again
      

    }// end then after uplink
    ) // end uplink execution
  } else {
    uplinkLog += logger.processLog('s',`AWAITING workerUplink COMPLETION`)
  } // end if still running



} // end set interval function

, 20000); //end set interval
