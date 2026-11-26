# 脱敏 SDP 摘录

这些是摘录，不是完整 SDP。ICE ufrag、密码、指纹、候选地址和 m 行端口已去掉。不能把这段当成可部署或可解析的完整 SDP。

本轮请求体只有键 `sdp`，没有 `type`，没有 `mode`。响应有 `sdp` 和 `type`（值为 `answer`）。

本轮 offer 与 answer 都只有一条 `m=audio` 行，没有 video 或 application 行。这是该次 SDP 的观察，不能推广成“能力配置里即使留下默认 video/application，也永远不会出现这些 m 行”。

## offer 音频段

```
m=audio [port] UDP/TLS/RTP/SAVPF 111 63 9 0 8 13 110 126
a=mid:0
a=sendrecv
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1
a=rtpmap:63 red/48000/2
a=fmtp:63 111/111
a=rtpmap:9 G722/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:13 CN/8000
a=rtpmap:110 telephone-event/48000
a=rtpmap:126 telephone-event/8000
a=ssrc:489390201
```

完整 offer 还带有候选、ICE 凭证和指纹，这里已省略。不要把未列出的行假装成不存在。

## 服务端发出的 answer 音频段

```
m=audio [port] UDP/TLS/RTP/SAVPF 111 0
a=setup:passive
a=mid:0
a=sendrecv
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1
a=rtpmap:0 PCMU/8000
```

服务端 answer 的 m 行端口是 9，不是 0；按 [RFC 3264 §6.1](https://www.rfc-editor.org/rfc/rfc3264.html#section-6.1)，端口为 0 才表示拒绝该流。连接地址写在候选行上（已省略）。浏览器应用后的 `remoteDescription` 仍是 PT 111 / 0、`opus/48000/2`、同一 fmtp 和 `a=sendrecv`，并把 m 行端口改成了后来选中的 host 端口。公开摘录统一写成 `[port]`。

answer 也列出了 PCMU PT 0。本轮实际发送并首次收到的是 PT 111。111 是这次协商映射，不是规范常量。
