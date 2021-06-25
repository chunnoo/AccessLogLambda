const aws = require("aws-sdk");
const s3 = new aws.S3({ apiVersion: "2006-03-01" });
const { spawn } = require("child_process");
const https = require('https');

const publicCert = `-----BEGIN CERTIFICATE-----
MIIEuDCCAqACCQDmt4fk5NQQ0TANBgkqhkiG9w0BAQsFADAeMRwwGgYDVQQDDBNj
bG91ZC52ZXNwYS5leGFtcGxlMB4XDTIxMDYyMzEwNDkyMloXDTIxMDcwNzEwNDky
MlowHjEcMBoGA1UEAwwTY2xvdWQudmVzcGEuZXhhbXBsZTCCAiIwDQYJKoZIhvcN
AQEBBQADggIPADCCAgoCggIBAMQSVsfUzHJEntziHT0XkjoHbpY2wSeDogcpz19a
hUpMXbmVXakAyZgIfr5YluwCWwUN+PLSHA6n/4VMOTr9AhyiiHDCgpw0Wwl+YJQm
gntBBtGAZQoabMIp6eJ/qWUPCnLpr8GnIOIFHkYQGxaa646iomQssePI0Mtk+RgM
POkdeEIlsbEUZajTZPTHw2HMUDAlrOrJ6VrT0iPLtKpKKCo6gksVVTItcozIJ5JE
Ks2/JxB9UY9yHakdybSq8FqSi0rlrNP6fLth7wt45JYUvo3oHE1Ok2L5O2UeN53F
1hY+Aarx+MqiHYzj5fuFDzVipcs4rAGSrs0tSkjQhmXwoRqbubkSA9QljZa/W15+
tou3rbX0zIr0GqX0Gfldyh/5ieCr5MIIZqBd7H1Xy9OAhw/jweeS6x+w3f/Dyerh
L1WccqsyTsgIDZsihDAS4phmjh5rhemtKgcInlgG56tnPsUqSdNrAL8JQlxX1Ilw
Ujn4e55s2VY77byEWdYDwYVmyMER60JGZWOwpaci52zFzpZXKQlrDAwLUZHQuK5G
wOMGaNYsvuWay2EY0Lpe7xoXJPbAdq4D9kWoas8hxTvHyPe6zrQLXwEcMghA0dV0
fK//VUh2WFgbrC2jz5zA/deA9u2IZu8cSMjbeix8pBhFrNwWz1ylCuOAQ+VWDJRF
FU1jAgMBAAEwDQYJKoZIhvcNAQELBQADggIBAEvZ1BosKZjc6LjR7T8ZfyvQlNON
Wt2pLiUJoO9PFc7bWt8nOHX9wVaaeX/KeKbjU04+ZbY41PtLSakpQ+zCJZB3NUVE
ZVVNjDRoOuuwTAr9KOHWWwx6NPOsxOkyvqkFuranrqgYaWj/o6rr3yiFq24eGGYt
WOC5UI+exzi3wc08k9VeVe7iF7b2OVRAkTbiE1r7C2x1+uQaRcnCmEX4Goy8qVV4
hU0ojjy/oeUQfWk+TbdlthQLwkjtpaRGYCxI/4o7Pq5DrF+mKXT6j+S8TQFqS7Sa
FjBCWNuedjAc3dirDReEMSSLmJjJX06K1kABo7H5I6Gsd+vJ1j2QvF9/bLIyuyt/
ImKFyxJO/MJjk3Y8S4thlRoDFdCM8Ujux3Iddyl1JDmFsAm2SO0JIHiGr4xQgSb0
jYN+3QQrtag2PKB0PgEykLNILvU19E91BNzHyI+kRLBxIigPB71HLvTtV+iezIwD
uxBRJXt8ua2L/HXX2d7qakoOi49sPCq3/US7PfvSlMztCjWYb9mNWbw/RIWWDUHE
Z3+IdJcZCD3Ljfp1REct9PLO4miKFsF3/bm4JHuMGgKUTTSjlWge56XZR1StY2fi
Z5lwithl8l1n6bVN59kr9gnFOZ85g/psxGyWSt7t0/hJFA+rumPMQZr7tX14TeUA
yyaxbpQv8eKLuK9R
-----END CERTIFICATE-----`;

const findRelevantKeys = ({ Bucket }) => {
  console.log(`Finding relevant keys in bucket ${Bucket}`);
  return s3
    .listObjectsV2({ Bucket })
    .promise()
    .then((res) =>
      res.Contents.map((content) => ({ Bucket, Key: content.Key })).filter(
        (obj) => /JsonAccessLog\.default\.\d+\.zst/.test(obj.Key)
      )
    )
    .catch((err) => Error(err));
};

const getObjectData = ({ Bucket, Key }) => {
  console.log(`Getting object with key ${Key} from bucket ${Bucket}`);
  return s3
    .getObject({ Bucket, Key })
    .promise()
    .then((res) => res.Body)
    .catch((err) => Error(err));
};

const decompress = (buffer) =>
  new Promise((resolve, reject) => {
    const zstd = spawn("zstd", ["-cd"]);

    zstd.stdout.on("data", (data) => {
      resolve(data.toString());
    });

    zstd.stderr.on("data", (err) => {
      reject(err);
    });

    zstd.stdin.write(buffer);
    zstd.stdin.end();
  });

const extractInput = (uri) =>
  decodeURIComponent(
    uri
      .match(/input=(.*)&jsoncallback/)[1]
      .replace(/%22/g, '"')
      .replace(/%5C/g, "\\")
      .replace(/%08|%09|%0A|%0B|%0C/g, "")
  );

const formatQuery = (logFile) => {
  return logFile
    .split(/(?:\r\n|\r|\n)/g)
    .filter((line) => line.match(/input=(.*)&jsoncallback/))
    .map((line) => JSON.parse(line))
    .map((obj) => ({ input: extractInput(obj.uri), time: obj.time }))
    .map((obj) => ({ fields: obj }));
};

const feedingFunction = async (feeding_query) => {
  console.log("in feedingFunction");
  var hostname = 'my-instance.secondapplication.firsttenant.aws-us-east-1c.dev.z.vespa-app.cloud';
  var query_path = '/document/v1/query/query/group/0/'; // for aa sende inn dokumenter med en gruppe
  var data = JSON.stringify(feeding_query);
  
  console.log("before query path add");
  query_path += feeding_query.fields.time;
  
  const ssm = new aws.SSM();
  const privateKeyParam = await new Promise((resolve, reject) => {
      console.log("getting secret key");
      ssm.getParameter({
          Name: 'ThePrivateKey',
          WithDecryption: true
      }, (err, data) => {
          if (err) { return reject(err); }
          return resolve(data);
      });
  });
  
  var options = {
      hostname: hostname,
      port: 443,
      path: query_path,
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length },
      key: privateKeyParam.Parameter.Value,
      cert: publicCert
  };

  const response = new Promise((resolve, reject) => {
      console.log("in response");
      const req = https.request(options, res => {
          console.log("in req");
          console.log('statusCode:', res.statusCode);
          res.on('data', d => {
              process.stdout.write(d);
          });
      });
      
      req.on('error', error => {
          console.error(error);
          console.log("ERROR");
          reject({
            statusCode: 500,
            body: 'Something went wrong!'
        });
      });

      console.log("writing data")
      req.write(data);
     
      req.end();
      
      req.on('end', () => {
          resolve({
                      statusCode: 200,
                      body: "Success"
                  });
      });
      console.log("ended")
  });
  return response;
  
};

exports.handler = async (event, context) => {
  const options = { Bucket: "olemagnustrainingbucket" };

  return findRelevantKeys(options)
    .then((objs) => Promise.all(objs.map((obj) => getObjectData(obj))))
    .then((buffers) => Promise.all(buffers.map((buffer) => decompress(buffer))))
    .then((logFiles) => logFiles.map((logFile) => formatQuery(logFile)).flat())
    .then(res => Promise.all(res.map(query => feedingFunction(query)))) 
    .then((res) =>  ({ statusCode: 200 }))
    .catch((err) => {
      console.error(err);
    return  { statusCode: 500, message: err }});
};
