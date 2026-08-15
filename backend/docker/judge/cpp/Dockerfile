FROM gcc:14

RUN useradd -m judge

COPY run.sh /usr/local/bin/run.sh

RUN chmod +x /usr/local/bin/run.sh

USER judge

ENTRYPOINT ["/usr/local/bin/run.sh"]
