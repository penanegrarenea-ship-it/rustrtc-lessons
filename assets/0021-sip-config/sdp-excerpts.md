# 0021 脱敏 SDP 摘录

上游固定 `f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa`。这里只有两种文本：官方示例源码里的模拟 offer，以及教学诊断程序（不是官方示例 stdout）的脱敏 answer。地址、端口、会话标识已替换或保持为源码中的文档示例地址。没有 ICE 凭证，没有指纹，没有真实 `a=crypto` 密钥。不能把这些片段当成可部署或可解析的完整会话描述。

## 官方示例内嵌的模拟远程 offer

这段与 `examples/rtp_track_event.rs` 42–54 行一致，也出现在本轮官方示例的 stdout 中。`10.0.1.100` 和 `5004` 是源码里的文档示例值，不是一次真实 INVITE 的对端地址。

```sdp
v=0
o=- 123456 123456 IN IP4 10.0.1.100
s=SIP Call
c=IN IP4 10.0.1.100
t=0 0
m=audio 5004 RTP/AVP 8 101
a=rtpmap:8 PCMA/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-15
a=sendonly
a=mid:0
```

阅读要点：协议 `RTP/AVP`，PT 8 = PCMA/8000，另有 telephone-event 101，方向 sendonly，无 `a=ice-*`，无 `a=crypto`，无 `a=fingerprint`。

## 诊断程序的本地 answer（脱敏）

本轮官方示例在 `create_answer` 之前因 SSRC 断言退出，没有打印 answer。下面来自复用同一 offer 与 `sip()`、只跳过该断言的诊断程序，运行于 2026-11-27 JST。`[addr]`、`[port]`、`[sess]`、`[vers]`、`[rtcp-port]` 是删除实际值后的标记。

```sdp
v=0
o=- [sess] [vers] IN IP4 [addr]
s=-
c=IN IP4 [addr]
t=0 0
m=audio [port] RTP/AVP 111
a=mid:0
a=recvonly
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1;stereo=1
a=rtcp:[rtcp-port]
```

阅读要点：协议仍是 `RTP/AVP`，方向 `recvonly`，有单独 RTCP 端口行，无 ICE/DTLS/SDES 属性。列出的格式是默认 Opus PT 111，不是 offer 中的 8 或 101。完整未脱敏文本只留在非公开验证目录。
