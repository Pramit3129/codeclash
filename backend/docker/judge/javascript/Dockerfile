FROM node:22-alpine

COPY run.sh /usr/local/bin/run.sh

RUN chmod +x /usr/local/bin/run.sh

USER node

ENTRYPOINT ["/usr/local/bin/run.sh"]
