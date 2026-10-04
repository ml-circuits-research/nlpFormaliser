#!/usr/bin/env bash
# Reproduces the environment used for the reported experiment (Ubuntu 24.04).
set -euo pipefail
DL=${DL:-/opt/dl}; mkdir -p "$DL"; cd "$DL"

# 1. SWI-Prolog (EVL checker)
apt-get install -y swi-prolog-nox

# 2. Python deps (transformers pinned to 4.x: amrlib 0.8 + slow T5 tokenizer)
pip install --break-system-packages torch amrlib penman lemminflect pydelphin \
    "transformers==4.46.3" sentencepiece protobuf word2number unidecode

# 3. AMR graph-to-text generator (amrlib T5) + T5 vocabulary (HuggingFace was not reachable,
#    so the tokenizer is rebuilt from the original T5 sentencepiece model on GCS)
mkdir -p amr t5tok
curl -sL https://github.com/bjascob/amrlib-models/releases/download/model_generate_t5wtense-v0_1_0/model_generate_t5wtense-v0_1_0.tar.gz | tar xz -C amr
curl -sL -o t5tok/spiece.model https://storage.googleapis.com/t5-data/vocabs/cc_all.32000/sentencepiece.model
python3 -c "from transformers import T5Tokenizer; T5Tokenizer('$DL/t5tok/spiece.model', extra_ids=100, model_max_length=512).save_pretrained('$DL/t5tok_full')"

# 4. Grammatical Framework 3.12 + RGL (English, Romanian)
curl -sL -o gf.deb https://github.com/GrammaticalFramework/gf-core/releases/download/release-3.12/gf-3.12-ubuntu-24.04.deb
apt-get install -y ./gf.deb
git clone --depth 1 https://github.com/GrammaticalFramework/gf-rgl.git
(cd gf-rgl && cp languages.csv languages.csv.orig && (head -1 languages.csv.orig; grep -E '^(Eng|Ron),' languages.csv.orig) > languages.csv \
   && mkdir -p /opt/gf-lib && bash Setup.sh --dest=/opt/gf-lib)

# 5. (optional) ERG + ACE for the fully symbolic DELPH-IN round trip
curl -sL -o erg-2025.dat.bz2 https://github.com/delph-in/erg/releases/download/2025/erg-2025-x86-64-0.9.34.dat.bz2 && bunzip2 -f erg-2025.dat.bz2
curl -sL https://sweaglesw.org/linguistics/ace/download/ace-0.9.34-x86-64.tar.gz | tar xz && cp ace-0.9.34/ace /usr/local/bin/ \
  || echo "ACE download failed (sweaglesw.org blocked?) - the erg back-end will be unavailable"
