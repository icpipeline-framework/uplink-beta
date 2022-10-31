 ### ICPipeline Uplink Module

Welcome to ICPipeline *Uplink*.

*Uplink* makes a *Worker* a Worker.  We don't know a better way to say that.  *Uplink* is the Javascript package that each ICPipeline Worker clones at birth, kicking off an *uplink.js* system thread that's intended run for the life of the Worker.  Indeed, if/when that thread isn't running, it isn't really a Worker.  The *uplink()* process first registers the Worker with ICPM; then it polls for the Worker's assignment/pairing with an ICPM Environment, and thereby the project it's being put to work on.  Once paired up, polling continues on the same 20-second interval for incoming task assignments (or *Jobs*) from ICPM.  Obviously, *Jobs* come from you, the user.  Your Workers' sole purpose is to fulfill the tasks you assign to them.

![icpipeline-uplink-overview.png](https://icpipeline.com/media/documentation/icpipeline-uplink-overview.png)
<p align="center" style="color:gray;font-size:14px;"> <b>Figure 4: ICPipeline Uplink Module Overview</b> </p>

**Uplink Lifecycle Outline**
This describes the basic flow of *Uplink* in action on a given Worker:

- The *Uplink* module code is maintained in its own Git repo (a submodule of the *ICPipeline master repo).

- Each ICPipeline Worker  -- at birth, as the first order of business -- clones, installs and kicks off an *Uplink* process.

- From this point, the *uplink()* thread runs, continually polling its designated ICPM (by canister ID, set as an *env var* in *worker.config.env*).  The iterative flow goes like so:

  - On its first *phone home*, *uplink()* *registers* the new Worker with ICPM, which assigns the Worker's ID.  This is automatic, and generally done in the time it takes to click over to your ICPM dashboard.
  - Polling continues, until *uplink()* encounters an ICPM *Environment* that does not have a Worker already assigned.  Upon encountering any such *Workerless* Environment in ICPM, any Worker will automatically assign itself to that Environment.  Now the Worker and the Environment are paired until further notice, i.e. until you decide otherwise.  Note that everything is automated to this point -- the user just added an Environment in the ICPM dashboard.  When an Environment is added, if there's an unregistered Worker available, pairing happens automatically.  And again, they're usually all paired up by the time you check.
  - Now the Worker is assigned to its Environment, ready to do work, and there's a *Deploy Now* button -- for deploying whatever *Project* is being managed in that Environment.  You can refer to the ICPM README for more detail.



**General FYI and Administrative Notes**
It should be noted in general that all Worker<>ICPM communications originate on the Worker side, as requests to ICPM.  There are no exceptions, and this is based on the fundamentals.  Internet Computer canisters, as you may know, issue requests only to other canisters.  That, in a nutshell, is why ICPipeline works this way.

*Uplink* communicates continually with ICPM, on a polling interval of 20 seconds.  Developer note: the interval setting is just a JS var, set right at the bottom of *uplink.js*.  But there are various interdependent, time-sensitive, *sync/async*, etc. pieces all going on here, so proceed with caution.

*Uplink* makes liberal use of its straightforward native *logger()* function, for fairly dense logging and reporting of Worker activities.  Log data relating to specific workflows (e.g. mid-flight during deployments) are pushed to the ICPM dashboard, near-realtime and in context, to facilitate monitoring.

It is worth noting that *Uplink* handles considerably more than just scheduling and ICPM communications. *Uplink* plays a core role in nearly all Worker activities; it's the brains of the Worker, so to speak.  As one example, if/when a Worker host is enabled with Internet Identity, *Uplink* handles that process end-to-end (*II-enablement* is another type of *Job*).  This is just to illustrate that nearly all the action on a Worker, including its own self-administration, proceeds through *Uplink*.
