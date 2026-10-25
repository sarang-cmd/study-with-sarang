#!/usr/bin/env bash
# Usage: bash scripts/make-signing-cert.sh [output folder, default ./signing]
# Creates a SELF-SIGNED code-signing certificate for Study with Sarang (RSA 3072, SHA-256, 5 years).
# A self-signed certificate proves the file was not altered after signing and gives it a stable publisher name,
# but Windows does not trust it, so SmartScreen still shows "Unknown publisher" on other PCs.
set -euo pipefail
OUT="${1:-signing}"; mkdir -p "$OUT"; cd "$OUT"
[ -f study-with-sarang-signing.pfx ] && { echo "already exists"; exit 0; }
PASS=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)
cat > openssl.cnf <<CNF
[req]
distinguished_name=dn
x509_extensions=ext
prompt=no
[dn]
CN=Study with Sarang
O=Sarang
C=DE
[ext]
basicConstraints=critical,CA:false
keyUsage=critical,digitalSignature
extendedKeyUsage=codeSigning
subjectKeyIdentifier=hash
CNF
openssl req -x509 -newkey rsa:3072 -sha256 -days 1825 -nodes -keyout key.pem -out study-with-sarang-signing.cer -config openssl.cnf
openssl pkcs12 -export -inkey key.pem -in study-with-sarang-signing.cer -out study-with-sarang-signing.pfx -name "Study with Sarang" -passout "pass:$PASS"
shred -u key.pem 2>/dev/null || rm -f key.pem
echo "$PASS" > PASSWORD.txt; chmod 600 PASSWORD.txt study-with-sarang-signing.pfx
openssl x509 -in study-with-sarang-signing.cer -noout -subject -dates -fingerprint -sha256
