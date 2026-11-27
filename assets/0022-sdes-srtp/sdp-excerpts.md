# 0022 脱敏 SDP 摘录

上游固定 `f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa`。这里只有教学诊断程序（不是官方测试 stdout）的脱敏摘录。地址、端口、会话标识、SSRC 和 `inline` 密钥已替换为标记。没有 ICE 凭证，没有指纹，没有真实 `a=crypto` 密钥。不能把这些片段当成可部署或可解析的完整会话描述。官方 7 个库测试通过时并不打印完整 SDP；它们只断言协议、属性存在性和前缀/后缀。

## 诊断：sip()+Sdes 的 create_offer

2026-11-27 18:29:03–18:29:38 JST，Linux 教学电脑。`[addr]`、`[port]`、`[sess]`、`[vers]`、`[rtcp-port]`、`[ssrc]`、`[cname]` 是删除实际值后的标记。

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

阅读要点：协议 `RTP/SAVP`，媒体级 `a=crypto`，tag 1，套件 `AES_CM_128_HMAC_SHA1_80`，带生存期 `|2^31`，无指纹、无 `a=setup`、无 ICE 属性。`a=rtcp-mux` 与 `a=rtcp:` 同时出现，与 `sip()` 的 `Negotiate` 策略一致；官方 offer 测试并未断言这两行。列出的格式是默认 Opus PT 111；官方测试也没有断言载荷类型。

## 诊断：对 tag 2、SHA1_32、生存期与 MKI 的 create_answer

远程 offer 使用运行时生成的密钥，形状为 `a=crypto:2 AES_CM_128_HMAC_SHA1_32 inline:<redacted>|2^31|1:1`，协议 `RTP/SAVP`，无 `a=rtcp-mux`。本课不转载上游测试夹具里的密钥。

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
a=rtcp:[rtcp-port]
a=crypto:2 AES_CM_128_HMAC_SHA1_32 inline:<redacted>|2^31
```

阅读要点：答案回显 tag 2、套件 `AES_CM_128_HMAC_SHA1_32` 和生存期 `|2^31`，没有 MKI。offer 未写 `a=rtcp-mux` 时，答案只有 `a=rtcp:`。这份诊断答案列出的仍是默认 Opus 111；官方测试未断言编解码交叉。完整未脱敏文本只留在非公开验证目录。
