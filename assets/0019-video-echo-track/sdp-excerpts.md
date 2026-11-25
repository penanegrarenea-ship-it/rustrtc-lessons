# 脱敏 SDP 摘录

这些是摘录，不是完整 SDP。ICE ufrag、密码、指纹、候选地址和 m 行端口已去掉。两轮的最终视频映射都来自当时的 answer 和 codec 统计，不是“96 这个数字永远等于 VP8”。

请求体键是 `sdp`、`type`、`mode`。两轮 `type` 都是 `offer`，`mode` 都是 `echo`。没有音频 m 行。

## session-a offer 视频段

```
m=video [port] UDP/TLS/RTP/SAVPF 96 97 102 103 104 107 108 109 114 115 116 117 39 40 45 46 98 99 100 101 118 119 120
a=mid:0
a=sendrecv
a=rtpmap:96 VP8/90000
a=rtpmap:97 rtx/90000
a=fmtp:97 apt=96
```

同一视频段里还有 H264、VP9、AV1、red、ulpfec 以及各自的 rtx。这里不把那些行冒充成不存在，也不把整份 offer 贴出来。另一条 m 行是 `m=application [port] UDP/DTLS/SCTP webrtc-datachannel`。

## session-a answer 视频段

```
m=video [port] UDP/TLS/RTP/SAVPF 96 97
a=setup:passive
a=mid:0
a=sendrecv
a=rtcp-mux
a=rtpmap:96 VP8/90000
a=rtpmap:97 rtx/90000
a=fmtp:97 apt=96
a=ssrc:5002 cname:rustrtc-cname-5002
a=ssrc:5002 msid:stream track-10018117834228818724
a=ssrc:1634385845 cname:rustrtc-cname-5002
a=ssrc:1634385845 msid:stream track-10018117834228818724
```

`a=fingerprint` 存在，算法是 sha-256，散列已遮掉。应用 m 行仍然在，端口已遮掉。

## session-b offer 视频段

模式和方向与 session-a 相同：`a=mid:0`、`a=sendrecv`、`a=rtpmap:96 VP8/90000`，并带有同一组其它编码。m 行端口不同，已遮掉。没有音频 m 行。

## session-b answer 视频段

```
m=video [port] UDP/TLS/RTP/SAVPF 96 97
a=setup:passive
a=mid:0
a=sendrecv
a=rtcp-mux
a=rtpmap:96 VP8/90000
a=rtpmap:97 rtx/90000
a=fmtp:97 apt=96
a=ssrc:5004 cname:rustrtc-cname-5004
a=ssrc:5004 msid:stream track-4953139077676328283
a=ssrc:2447601968 cname:rustrtc-cname-5004
a=ssrc:2447601968 msid:stream track-4953139077676328283
```

两轮 answer 都留下 PT 96 的 VP8/90000，以及 PT 97 的 rtx（`apt=96`）。主视频统计挂在 PT 96 上。第二组 SSRC 与统计里的 `rtxSsrc` 对应，不拿来和主 SSRC 混算。
