# syntax=docker/dockerfile:1.4
# Workshop pod image: local helmet-workshop (build context) + local Helmet (extra build context).
#
#   ./container/build.sh
#
# Requires a sibling Helmet checkout (default: ../helmet). Override:
#   WORKSHOP_IMAGE=... HELMET_BRANCH=composable_bundles ./container/build.sh
ARG BASE_IMAGE=registry.access.redhat.com/ubi9/ubi:latest
FROM ${BASE_IMAGE}

ARG HELM_VERSION=v3.16.3

RUN dnf install -y \
    git \
    golang \
    jq \
    make \
    nodejs \
    npm \
    && dnf clean all

# Helm is not packaged in UBI AppStream; install the upstream binary.
ARG TARGETARCH
RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) HELM_ARCH=amd64 ;; \
      arm64) HELM_ARCH=arm64 ;; \
      *) echo "unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    curl -sSL "https://get.helm.sh/helm-${HELM_VERSION}-linux-${HELM_ARCH}.tar.gz" \
      | tar -xz -C /usr/local/bin --strip-components=1 "linux-${HELM_ARCH}/helm"; \
    helm version --short

RUN curl -sSL "https://mirror.openshift.com/pub/openshift-v4/clients/ocp/stable/openshift-client-linux.tar.gz" \
    | tar -xz -C /usr/local/bin oc kubectl

# OpenShift runs containers with an arbitrary UID (group 0). Own content as 1001:0 with g+rwX.
RUN useradd -u 1001 -g 0 -m -d /home/workshop -s /bin/bash workshop

COPY --from=helmet . /home/workshop/helmet
COPY . /home/workshop/helmet-workshop
# OpenShift assigns a random UID; g+rwX alone fails if the process is not in group 0.
# Workshop content is non-secret lab material — world read/write is OK in an isolated namespace.
RUN chown -R 1001:0 /home/workshop && \
    chmod -R a+rwX /home/workshop

USER 1001

ENV HOME=/home/workshop
ENV HELMET_SRC=/home/workshop/helmet
ENV ORDER_DEMO_HOME=/home/workshop/helmet-workshop/order-demo
ENV PATH="/home/workshop/go/bin:${PATH}"
ENV GOMODCACHE=/tmp/go-mod
ENV GOCACHE=/tmp/go-cache

WORKDIR /home/workshop/helmet-workshop/order-demo
RUN go mod download

CMD ["sleep", "infinity"]
