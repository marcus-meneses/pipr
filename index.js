const fs = require("fs");
const path = require("path");
const utils = require("./classes/Utils");
const decompress = require("decompress");
const express = require("express");
const Docker = require("dockerode");
const { exec } = require("child_process");

const PORTS_LOWER_BOUND = 3000;
const PORTS_UPPER_BOUND = 8000;

class ContainerInstance {
  name = "";
  id = "";
  port = "";
  status = "";
  logs = "";
  timeOut = null;
}

class FunctionsInstance {
  name = "";
  id = "";
  image = "";
  config = {};
  instances = [];
}

class TenantInstance {
  name = "";
  id = "";
  functions = [];
}

class DockerController {
  tenants = [];
  dockerTimeouts = [];
  portsAvailable = {};

  constructor() {
    for (let i = PORTS_LOWER_BOUND; i <= PORTS_UPPER_BOUND; i++) {
      this.portsAvailable[i.toString()] = true;
    }

    this.docker = new Docker({ socketPath: "/var/run/docker.sock" });
    this.loadTenants();
  }

  loadFunctions(tenant, tenantPath) {
    const functionDirs = fs.readdirSync(tenantPath);
    functionDirs.forEach((functionDir) => {
      const functionPath = path.join(tenantPath, functionDir);
      if (fs.statSync(functionPath).isDirectory()) {
        const functionInstance = new FunctionsInstance();
        functionInstance.name = functionDir;
        functionInstance.image = utils.listZipFiles(functionPath)[0];
        functionInstance.config = JSON.parse(
          fs.readFileSync(path.join(functionPath, "config.json"), "utf8")
        );
        tenant.functions.push(functionInstance);
      }
    });
  }

  loadTenants() {
    const tenantsDir = path.join(__dirname, "functions");
    const tenantDirs = fs.readdirSync(tenantsDir);
    tenantDirs.forEach((tenantDir) => {
      if (tenantDir === "_tmp") return;
      const tenantPath = path.join(tenantsDir, tenantDir);
      if (fs.statSync(tenantPath).isDirectory()) {
        const tenant = new TenantInstance();
        tenant.name = tenantDir;
        this.loadFunctions(tenant, tenantPath);
        this.tenants.push(tenant);
      }
    });
  }

  validateFunction(tenant, functionName) {
    const tenantInstance = this.tenants.find((t) => t.name === tenant);
    if (!tenantInstance) {
      return false;
    }
    const functionInstance = tenantInstance.functions.find(
      (f) => f.name === functionName
    );
    if (!functionInstance) {
      return false;
    }
    return true;
  }

  hasRunningContainer(tenant, functionName) {
    const tenantInstance = this.tenants.find((t) => t.name === tenant);
    if (!tenantInstance) {
      throw new Error(`Tenant ${tenant} not found.`);
    }
    const functionInstance = tenantInstance.functions.find(
      (f) => f.name === functionName
    );
    if (!functionInstance) {
      throw new Error(`Function ${functionName} not found.`);
    }
    return functionInstance.instances.length > 0;
  }
}

const dockerController = new DockerController();
const app = express();

app.use("/", (req, res) => {
  const reqdata = {
    subdomain: req.subdomains,
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
    querystring: req.originalUrl || "",
  };

  const tenant = reqdata.subdomain[2];
  const functionName = reqdata.subdomain[1];

  const isFunction = dockerController.validateFunction(tenant, functionName);

  if (!isFunction) {
    res.status(404).send({error: 'Function or tenant not found', status: 404, message: 'The function or tenant you are looking for does not exist. Please check your URI and try again.'});
    return;
  }

  res.send(dockerController.tenants);
});

app.listen(3000, () => {
  console.log(`Running on http://localhost:3000`);
});
