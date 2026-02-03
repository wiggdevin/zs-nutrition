var fs = require("fs");
var p = "/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/verification/test-runner/test-signup-onboarding.mjs";
var s = fs.readFileSync(p, "utf8");
s = s.split("3007").join("3101");
s = s.split("networkidle").join("domcontentloaded");
fs.writeFileSync(p, s);
console.log("done");
