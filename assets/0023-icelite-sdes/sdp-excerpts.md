# 0023 脱敏 SDP 摘录

上游固定 `f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa`。这里只有教学诊断程序（不是官方测试 stdout）的脱敏摘录。地址、端口、会话标识、SSRC、`ice-ufrag`、`ice-pwd` 和 `inline` 密钥已替换为标记。不能把这些片段当成可部署或可解析的完整会话描述。官方库测试通过时并不打印完整 SDP；主测试只断言属性存在性和 Controlled 角色。

## 诊断：sip()+IceLite+Sdes 的 create_offer

2026-11-27 19:46:21–19:46:55 JST，Linux 教学电脑。`[addr]`、`[port]`、`[sess]`、`[vers]`、`[rtcp-port]`、`[ssrc]`、`[cname]`、`[ufrag]`、`[ice-pwd]`、`[foundation]`、`[prio]` 是删除实际值后的标记。

```sdp
v=0
o=- [sess] [vers] IN IP4 [addr]
s=-
c=IN IP4 [addr]
t=0 0
a=ice-lite
m=audio [port] RTP/SAVP 111
a=ice-ufrag:[ufrag]
a=ice-pwd:[ice-pwd]
a=candidate:[foundation] 1 udp [prio] [addr] [port] typ host
a=candidate:[foundation] 2 udp [prio] [addr] [port] typ host
a=sendrecv
a=end-of-candidates
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1;stereo=1
a=rtcp-mux
a=rtcp:[rtcp-port]
a=ssrc:[ssrc] cname:[cname]
a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:<redacted>|2^31
```

阅读要点：`a=ice-lite` 在会话级（`m=` 之前）。媒体协议是 `RTP/SAVP`。媒体级同时有 ICE 凭证、两条 `typ host` 候选（组件 1 为 RTP，组件 2 为 RTCP，传输写作 `udp`）和 `a=crypto`。带生存期 `|2^31`，无指纹、无 `a=setup`。`a=rtcp-mux` 与 `a=rtcp:` 同时出现，与 `sip()` 的 `RtcpMuxPolicy::Negotiate` 一致；官方测试并未断言这两行或候选条数。列出的格式是默认 Opus PT 111；官方测试也没有断言载荷类型。

## 诊断：对全量 ICE、SAVP、无 ice-lite 的远程 offer 做 create_answer

远程 offer 使用运行时生成的密钥和 ICE 凭证，形状为 RTP/SAVP、PCMU PT 0、`a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:<redacted>`、`a=ice-ufrag` / `a=ice-pwd` / 一条 `typ host` 候选，没有 `a=ice-lite`，也没有 `a=rtcp-mux`。本课不转载上游测试夹具里的密钥和口令。这条形状对应主路径官方测试所用的对端类型：带 ICE 的话机作为全量 ICE offerer。

```sdp
v=0
o=- [sess] [vers] IN IP4 [addr]
s=-
c=IN IP4 [addr]
t=0 0
a=ice-lite
m=audio [port] RTP/SAVP 111
a=ice-ufrag:[ufrag]
a=ice-pwd:[ice-pwd]
a=candidate:[foundation] 1 udp [prio] [addr] [port] typ host
a=candidate:[foundation] 2 udp [prio] [addr] [port] typ host
a=sendrecv
a=end-of-candidates
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1;stereo=1
a=rtcp:[rtcp-port]
a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:<redacted>
```

阅读要点：答案写出会话级 `a=ice-lite`，协议 `RTP/SAVP`，媒体级同时有 ICE 凭证、组件 1 与 2 的 `typ host` 候选，以及 `a=crypto`。因诊断 offer 未写生存期，答案也没有 `|2^31`。offer 未写 `a=rtcp-mux` 时，答案只有 `a=rtcp:`，仍为两个组件保留候选。这份诊断答案列出的仍是默认 Opus 111，不是 offer 里的 PCMU 0；官方测试未断言编解码交叉。完整未脱敏文本只留在非公开验证目录。

## 对照诊断：sip()+IceLite（Keying::None）的 create_offer

```sdp
v=0
o=- [sess] [vers] IN IP4 [addr]
s=-
c=IN IP4 [addr]
t=0 0
a=ice-lite
m=audio [port] RTP/AVP 111
a=ice-ufrag:[ufrag]
a=ice-pwd:[ice-pwd]
a=candidate:[foundation] 1 udp [prio] [addr] [port] typ host
a=candidate:[foundation] 2 udp [prio] [addr] [port] typ host
a=sendrecv
a=end-of-candidates
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1;stereo=1
a=rtcp-mux
a=rtcp:[rtcp-port]
a=ssrc:[ssrc] cname:[cname]
```

阅读要点：只改 `connectivity = IceLite`、保持 `Keying::None` 时，ICE 属性仍在，但协议回到 `RTP/AVP`，没有 `a=crypto`。这与对照测试 `rtp_mode_ice_lite_sdp_attributes` 的断言方向一致；该官方测试同样未断言载荷类型。
