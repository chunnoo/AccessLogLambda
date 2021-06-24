# access-log-lambda

**Requirements**

<pre>
$ brew install awscli
$ brew tap aws/tap
$ brew install aws-sam-cli
</pre>


**Configure**

Change BucketName in *template.yaml*.
<pre>
$ aws configure
</pre>


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
