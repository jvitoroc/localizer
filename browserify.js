const browserify = require("browserify");
Buffer = require('buffer').Buffer;
const fs = require("fs");

const bundler = browserify(); 

bundler.add("./src/index.js");
//bundler.transform("browserify-shim");
bundler.transform("babelify", {
    presets: ["env"],
    sourceMaps: false,
    plugins: ['transform-runtime']
});

bundler.bundle().pipe(fs.createWriteStream("bundle.js"));