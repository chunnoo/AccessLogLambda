FROM public.ecr.aws/lambda/nodejs:14

COPY app.js package.json ./

RUN yum update
RUN yum -y install zstd

RUN npm install

# Command can be overwritten by providing a different command in the template directly.
CMD ["app.handler"]
