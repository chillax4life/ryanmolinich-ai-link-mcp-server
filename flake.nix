{
  description = "Antigravity Command Center - A reproducible multi-agent environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    # Rust overlay for up-to-date Rust toolchains
    rust-overlay.url = "github:oxalica/rust-overlay";
    rust-overlay.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs {
          inherit system overlays;
          config.allowUnfree = true;
        };

        # The core toolset
        devTools = with pkgs; [
          # Rust
          (rust-bin.stable.latest.default.override {
            extensions = [ "rust-src" "rust-analyzer" ];
          })
          
          # Node / TypeScript
          nodejs_20
          yarn
          nodePackages.typescript
          nodePackages.ts-node
          
          # Python (for specific AI agents if needed)
          (python311.withPackages (ps: with ps; [
            pip
            virtualenv
            requests
          ]))

          # System
          git
          docker
          zsh
          jq
          curl
        ];

      in
      {
        # 1. The Development Shell (for local use)
        devShells.default = pkgs.mkShell {
          buildInputs = devTools;

          shellHook = ''
            echo "🚀 Welcome to the Antigravity Command Center"
            echo "Tools loaded: Rust $(rustc --version), Node $(node --version), Python $(python3 --version)"
          '';
        };

        # 2. The Docker Image (built via Nix)
        packages.antigravity-docker-image = pkgs.dockerTools.buildImage {
          name = "antigravity-hub-image";
          tag = "latest";
          created = "now";
          
          # Copy our tools into the image
          copyToRoot = pkgs.buildEnv {
            name = "image-root";
            paths = devTools ++ [ pkgs.bashInteractive pkgs.coreutils ];
            pathsToLink = [ "/bin" "/usr/bin" ];
          };

          config = {
            Cmd = [ "/bin/bash" ];
            WorkingDir = "/app";
            Env = [
              "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
              "PATH=/bin:/usr/bin:${pkgs.lib.makeBinPath devTools}"
            ];
          };
        };
      }
    );
}
