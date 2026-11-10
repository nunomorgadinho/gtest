#!/usr/bin/env python3
"""Cria a chave RSA e o certificado com que a app assina os APK que gera (app/key.js).
A chave fica dentro da app, por isso é pública: serve apenas para o Android aceitar instalar os jogos."""
import sys, json, subprocess, tempfile, os
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
import datetime

out = sys.argv[1]
k = rsa.generate_private_key(public_exponent=65537, key_size=2048)
name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Mago dos Jogos'), x509.NameAttribute(NameOID.ORGANIZATION_NAME, 'Jogos criados com Mago dos Jogos')])
now = datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc)
cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(k.public_key())
        .serial_number(x509.random_serial_number()).not_valid_before(now)
        .not_valid_after(now + datetime.timedelta(days=365 * 30)).sign(k, hashes.SHA256()))
n = k.private_numbers()
h = lambda v: format(v, 'x')
data = {
    'n': h(n.public_numbers.n), 'e': h(n.public_numbers.e), 'd': h(n.d), 'p': h(n.p), 'q': h(n.q),
    'dp': h(n.dmp1), 'dq': h(n.dmq1), 'qi': h(n.iqmp),
    'cert': cert.public_bytes(serialization.Encoding.DER).hex(),
    'spki': k.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo).hex(),
}
with open(out, 'w') as f:
    f.write('/* Chave de assinatura dos jogos exportados (gerada por tools/make_key.py). */\nwindow.MDJ_KEY = ' + json.dumps(data) + ';\n')
print('chave criada:', out)
