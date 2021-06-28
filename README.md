# access-log-lambda

## Steps

**Requirements**

<pre>
$ brew install awscli
$ brew tap aws/tap
$ brew install aws-sam-cli
</pre>


**Configure AWS**

<pre>
$ aws configure
</pre>
See <https://docs.aws.amazon.com/IAM/latest/UserGuide/getting-started_create-admin-group.html> for description of how to set up relevant keys.


**Set bucketname**

Change the Parameter AccessLogBucketName in *template.yaml* to the bucket where the access logs are stored.


**Create parameter for vespa private key**

In AWS System Manager - Parameter Store, create a new parameter named **AccessLogPrivateKey** with the value of the private key to the Vespa application where queries should be fed.


**Set endpoint and public certificate**

In *access-log/app.js*, set **vespaHostname** to the endpoint of the Vespa application where queries should be fed and set *publicCert* to the public certificate of the same Vespa application.


**Build**

<pre>
$ sam build
</pre>


**Create ECR repository for docker image**

<pre>
$ aws ecr create-repository --repository-name access-log-repository --image-tag-mutability IMMUTABLE --image-scanning-configuration scanOnPush=true
</pre>


**Deploy**

<pre>
$ sam deploy --guided
</pre>


**Test locally**

This will still query the AWS S3 Bucket
<pre>
$ sam local invoke "AccessLogFunction" -e events/event.json
</pre>


**Clean up**

Useful when encountering deploy errors.
<pre>
$ aws cloudformation delete-stack --stack-name access-log-lambda --region eu-north-1
</pre>

## Details

**AWS CloudTrail and Amazon EventBridge**

Lambda functions created with the AWS Serverless Application Model cannot be directly triggered by a S3 Bucket outside its own application stack. This is due to some limitations in AWS CloudFormation. A work around for doing this is to create a AWS CloudTrail for events from the existing S3 Bucket and use Amazon EventBridge to trigger the lambda function on events from this CloudTrail. See <https://aws.amazon.com/blogs/compute/using-dynamic-amazon-s3-event-handling-with-amazon-eventbridge/>
