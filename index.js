const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const fs = require("fs").promises;

const METRICS_VARS = {
  download: {
    label: "download / 10",
    backgroundColor: "#36A2EB",
  },
  upload: {
    label: "upload / 10",
    backgroundColor: "#CC65FE",
  },
  latency: {
    label: "latency",
    backgroundColor: "#FF6384",
  }
};
const METRICS_FILE = "./metrics.json";
const METRICS_TIME = 5;

function shell(cmd) {
  const exec = require("child_process").exec;
  return new Promise((resolve, _) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.warn(error);
      }
      resolve(stdout ? stdout : stderr);
    });
  });
}

const width = 2200;
const height = 1200;
const backgroundColour = "white";
const chartJS = new ChartJSNodeCanvas({
  width, height, backgroundColour, chartCallback: (ChartJS) => {
    ChartJS.defaults.devicePixelRatio = 3
  }
});

async function configuration() {
  const metrics = await read();
  return {
    type: "line",
    data: {
      datasets: Object.keys(METRICS_VARS)
        .map(metric => {
          const { label, backgroundColor } = METRICS_VARS[metric];
          return {
            label,
            borderColor: backgroundColor,
            backgroundColor,
            data: metrics.map(each => {
              return {
                x: each.time,
                y: each[metric],
              };
            }),
          };
        }),
    },
  };
}

async function plot() {
  const config = await configuration();
  const dataUrl = await chartJS.renderToDataURL(config);
  const data = dataUrl.replace(/^data:image\/png;base64,/, "");
  await fs.writeFile("metrics.png", data, "base64");
}

async function read() {
  return JSON.parse(await fs.readFile(METRICS_FILE, "utf8"));
}

async function write(data) {
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(METRICS_FILE, json);
}

async function speed() {
  const json = JSON.parse(await shell("./node_modules/fast-cli/cli.js --upload --json"));
  const moment = new Date();
  const object = {
    time: `${moment.getUTCHours()}:${moment.getUTCMinutes()}`,
    download: json.downloadSpeed / 10,
    upload: json.uploadSpeed / 10,
    latency: json.latency,
  };
  const metrics = await read();
  metrics.push(object);
  await write(metrics);
}

process.on("SIGINT", async function () {
  console.log("Caught interrupt signal");
  await plot();
  process.exit();
});

(async () => {
  try {
    await write([]);
    await speed();
    setInterval(speed, 60 * 1000 * METRICS_TIME);
  } catch (err) {
    console.error(err);
  }
})();