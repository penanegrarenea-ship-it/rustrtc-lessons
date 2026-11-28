# 0024 脱敏 SDP 摘录

上游固定 `f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa`。这里只有教学诊断程序（不是官方测试 stdout）的脱敏摘录。地址、端口、会话标识、SSRC 已替换为标记。指纹是 SDP 里的公开材料，下面保留本轮真实跑出的值，没有编造。`a=crypto` 的 inline 密钥已删除。不能把这些片段当成可部署或可解析的完整会话描述。官方 `sdp_dtls` 通过时并不打印完整 SDP。

## 诊断：sip()+Keying::Dtls 的 create_offer

2026-11-28 12:33:09–12:33:42 JST，Linux 教学电脑。从 `RtcConfiguration::sip()` 只改 `keying = Keying::Dtls`。`[addr]`、`[port]`、`[sess]`、`[vers]`、`[rtcp-port]`、`[ssrc]`、`[cname]` 是删除实际值后的标记。

```sdp
v=0
o=- [sess] [vers] IN IP4 [addr]
s=-
c=IN IP4 [addr]
t=0 0
m=audio [port] UDP/TLS/RTP/SAVPF 111
a=fingerprint:sha-256 95:F3:F8:4E:54:E6:8F:1C:35:A8:9B:B3:0A:E2:86:64:B2:90:74:4A:B9:04:26:6B:D7:DF:18:8C:AB:52:96:66
a=setup:actpass
a=sendrecv
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1;stereo=1
a=rtcp-mux
a=rtcp:[rtcp-port]
a=ssrc:[ssrc] cname:[cname]
```

阅读要点：协议是 `UDP/TLS/RTP/SAVPF`。`a=fingerprint` 与 `a=setup:actpass` 在媒体级。没有 `a=crypto`，也没有 ICE 属性。`a=rtcp-mux` 与 `a=rtcp:` 同时出现，与 `sip()` 的 `RtcpMuxPolicy::Negotiate` 一致；官方 `check_description` 并未断言这两行。列出的格式是默认 Opus PT 111。

## 诊断：对上述 sip()+Dtls offer 做 create_answer

应答端同样从 `sip()` 只改 `Keying::Dtls`。远程 offer 就是上一节那份诊断 offer，证书和指纹在运行时生成，不使用夹具私钥。

```sdp
v=0
o=- [sess] [vers] IN IP4 [addr]
s=-
c=IN IP4 [addr]
t=0 0
m=audio [port] UDP/TLS/RTP/SAVPF 111
a=fingerprint:sha-256 95:F3:F8:4E:54:E6:8F:1C:35:A8:9B:B3:0A:E2:86:64:B2:90:74:4A:B9:04:26:6B:D7:DF:18:8C:AB:52:96:66
a=setup:passive
a=sendrecv
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1;stereo=1
a=rtcp-mux
```

阅读要点：答案的协议仍是 `UDP/TLS/RTP/SAVPF`，有指纹与 `a=setup:passive`，没有 `a=crypto`，没有 ICE 属性。offer 已写 `a=rtcp-mux` 时，答案只保留 `a=rtcp-mux`，不再写 `a=rtcp:`。编解码交集是 Opus PT 111。本轮 offer 与 answer 的指纹相同，是因为同一进程里 `generate_certificate` 会缓存并复用证书；答案写的是本端证书指纹，不是从 offer 抄来的。完整未脱敏文本只留在非公开验证目录。

## 对照诊断：默认 sip() 与 sip()+Sdes 的 create_offer

默认 `sip()`（`Keying::None`）：

```sdp
v=0
o=- [sess] [vers] IN IP4 [addr]
s=-
c=IN IP4 [addr]
t=0 0
m=audio [port] RTP/AVP 111
a=sendrecv
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1;stereo=1
a=rtcp-mux
a=rtcp:[rtcp-port]
a=ssrc:[ssrc] cname:[cname]
```

`sip()` 只改 `Keying::Sdes`：

```sdp
v=0
o=- [sess] [vers] IN IP4 [addr]
s=-
c=IN IP4 [addr]
t=0 0
m=audio [port] RTP/SAVP 111
a=sendrecv
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1;stereo=1
a=rtcp-mux
a=rtcp:[rtcp-port]
a=ssrc:[ssrc] cname:[cname]
a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:<redacted>|2^31
```

阅读要点：只改回 `Keying::None` 时，协议回到 `RTP/AVP`，没有指纹、没有 setup、没有 crypto。只改 `Sdes` 时，协议是 `RTP/SAVP`，有媒体级 `a=crypto`（本轮库生成的 offer 带生存期 `|2^31`），仍然没有指纹和 ICE 属性。这与对照测试 `sdp_none`、`sdp_sdes` 的断言方向一致。
