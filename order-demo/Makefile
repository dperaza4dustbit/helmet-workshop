.PHONY: build installer-tar clean

HELMET_ROOT ?= ../helmet
HELMET_BRANCH ?= composable_bundles
MCP_IMAGE ?= $(WORKSHOP_IMAGE)
INSTALLER_DIR := installer
TAR := $(INSTALLER_DIR)/installer.tar

LDFLAGS :=
ifneq ($(MCP_IMAGE),)
LDFLAGS += -X main.defaultMCPImage=$(MCP_IMAGE)
endif

build: go.sum $(TAR)
	go build $(if $(LDFLAGS),-ldflags "$(LDFLAGS)",) -o order-demo .

# Resolve Helmet replace module checksums (run once locally after changing ../helmet branch).
go.sum: go.mod
	@test -f $(HELMET_ROOT)/go.mod || (echo "missing $(HELMET_ROOT); set HELMET_ROOT or checkout $(HELMET_BRANCH) there" && exit 1)
	go mod tidy

deps: go.sum

installer-tar: $(TAR)

$(TAR):
	@test -d $(INSTALLER_DIR) || (echo "missing $(INSTALLER_DIR)" && exit 1)
	tar -C $(INSTALLER_DIR) -cf $(TAR) \
		helmet.yaml config values.yaml.tpl bundles

clean:
	rm -f order-demo $(TAR)
