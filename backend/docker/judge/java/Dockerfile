FROM eclipse-temurin:21-jdk-alpine

RUN adduser -D judge

COPY run.sh /usr/local/bin/run.sh

RUN chmod +x /usr/local/bin/run.sh

USER judge

ENTRYPOINT ["/usr/local/bin/run.sh"]
