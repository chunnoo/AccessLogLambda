const aws = require("aws-sdk");
const s3 = new aws.S3({ apiVersion: "2006-03-01"});
const { spawn } = require("child_process");

const findRelevantKeys = ({ Bucket }) => {
  console.log(`Finding relevant keys in bucket ${Bucket}`);
  return s3.listObjectsV2({ Bucket }).promise()
    .then(res => res.Contents
      .map(content => ({ Bucket, Key: content.Key }))
      .filter(obj => /JsonAccessLog\.default\.\d+\.zst/.test(obj.Key)))
    .catch(err => Error(err));
};

const getObjectData = ({ Bucket, Key }) => {
  console.log(`Getting object with key ${Key} from bucket ${Bucket}`);
  return s3.getObject({ Bucket, Key }).promise()
    .then(res => res.Body)
    .catch(err => Error(err));
};

const decompress = (buffer) => new Promise((resolve, reject) => {
  const zstd = spawn("zstd", ["-cd"]);

  zstd.stdout.on("data", data => {
    resolve(data.toString());
  });

  zstd.stderr.on("data", err => {
    reject(err);
  });

  zstd.stdin.write(buffer);
  zstd.stdin.end();
});

exports.handler = async (event, context) => {
  const options = { Bucket: "chunnoo-test-bucket" };

  return findRelevantKeys(options)
    .then(objs => Promise.all(
      objs.map(obj => getObjectData(obj))))
    .then(buffers => Promise.all(
      buffers.map(buffer => decompress(buffer))))
    .then(res => {
      console.log("response: ", res);
      return {statusCode: 200};
    })
    .catch(err => ({statusCode: 500, message: err}));
};
