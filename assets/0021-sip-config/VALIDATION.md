# 0021 sip() 与纯 RTP 音频协商（rtp_track_event）：脱敏验证摘要

验证日期 2026-11-27，所有时刻为 Asia/Tokyo（JST）。上游固定 `f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa`。本轮未改库、依赖或官方示例，也没有给上游开 PR。此文件是实际验证材料的字段摘录，不是用户本机结果，也不是真实 RTP 收包或 Windows 成功记录。

## 环境和命令

- 通过运行发生在 Linux 教学电脑：Debian GNU/Linux 13（trixie），kernel 6.12.113+。不是用户的 Windows。
- rustc 1.100.0 (0ef1bc386 2026-11-09)，cargo 1.100.0 (3acc79c0c 2026-11-05)，显式使用 `+1.100.0`。此提交 `edition = "2024"`。
- 在固定提交的仓库根目录执行 `cargo +1.100.0 run --example rtp_track_event`。编译保留原库三条 `fetch_update` 弃用警告，不是本课改了依赖。运行后 HEAD 仍是上述固定提交。示例进程在退出后已不在，没有残留监听。
- 该示例不绑定 3000 端口。文中 3000 只与过时断言里的 SSRC 开区间 `2000..3000` 有关。

## 官方示例本轮结果（2026-11-27）

- 命令于 12:01:16 JST 开始。`Finished dev` 用时 8.66 秒，随后运行 `target/debug/examples/rtp_track_event`。
- stdout 打印了示例内嵌的模拟远程 offer：`m=audio 5004 RTP/AVP 8 101`，`a=rtpmap:8 PCMA/8000`，`a=sendonly`，无 ICE 属性，无 `a=crypto`。这段文本来自源码，不是一次真实 SIP INVITE。
- 12:01:25.141747 JST（由日志中的 `2026-11-27T03:01:25.141747Z` 换算）之后打印 `Initial SSRC: 0 (provisional, range 2000-2999)`。
- stderr：`thread 'main' panicked at examples/rtp_track_event.rs:67:9: Should be provisional SSRC`。退出码 101。结束时刻 12:01:25 JST。
- 没有本地 answer，没有 “Example complete”，没有 Track 事件，也没有等到示例里的 2 秒睡眠。
- DEBUG 日志出现过本机 host 候选地址。这不是 SDP 里协商了 ICE 的证据；公开材料不转载具体地址。

## 同一提交上的官方测试

2026-11-27 12:10:54–12:11:23 JST，执行：

`cargo +1.100.0 test --lib -- --nocapture --test-threads=1`，过滤器为下列 11 个测试名。编译约 28.96 秒，测试本身 0.03 秒，11 passed、0 failed，退出码 0。HEAD 仍是固定提交。测试 stdout 没有打印 ICE 密码或 `a=crypto` 密钥。

- `rtp_mode_sends_track_event_after_ssrc_latching`：打印 `initial unknown SSRC: 0`。测试体在断言 SSRC 为 0 后结束，**没有真正发送 RTP，也没有等待 Track 事件**。
- `rtp_mode_track_event_after_set_remote`：offer 无 `a=ssrc` 时，SSRC 为 0。
- `rtp_mode_track_event_with_remote_ssrc`：offer 含 `a=ssrc:55555` 时，接收 SSRC 为 55555。
- `rtp_mode_no_ice_dtls_artifacts`、`rtp_mode_no_ice_lite_no_ice_attributes`：`sip()` 描述为 RTP/AVP，无 ICE/DTLS 属性。
- `rtp_mode_ice_lite_sdp_attributes`：`sip()` + IceLite 的 offer 含 `a=ice-lite`、ufrag、pwd、candidate，仍为 RTP/AVP，无指纹。
- `create_offer_srtp_mode_includes_crypto`、`create_answer_srtp_mode_uses_savp_profile`：`sip()` + Sdes 使用 RTP/SAVP，且存在 `a=crypto`。
- `srtp_mode_ice_lite_answer_has_ice_attributes`：`sip()` + IceLite + Sdes 的 answer 同时含 ICE-lite 属性与 `a=crypto`。
- `rtp_mode_answer_omits_rtcp_mux_when_offer_omits_it`：offer 无 `a=rtcp-mux` 时，answer 无 `a=rtcp-mux`、有 `a=rtcp:`。
- `rtp_mode_answerer_connects_on_set_remote`：按 offer 的 `c=`/`m=` 地址把状态推到 Connected。这不是 Track，也不是音频收包。

本轮没有跑 `tests/connectivity_keying.rs` 里两端互发媒体的测试，也没有跑真实话机或公网。

## 诊断程序（不是官方示例）

为观察跳过过时断言之后的 `create_answer` 结果，另写了一个不发表的诊断程序：复用示例的 offer 与 `RtcConfiguration::sip()`，不改库。2026-11-27 12:10:51–12:11:20 JST，退出码 0。配置字段打印为 `connectivity=Sdp keying=None webrtc_extensions=false rtcp_mux_policy=Negotiate bundle_policy=Balanced`。`set_remote` 与 `set_local` 之后 SSRC 仍为 0。等待 2 秒没有 Track 事件。

脱敏后的 answer 要点：`m=` 协议为 `RTP/AVP`，方向 `a=recvonly`，有 `a=rtcp:`，无 `a=crypto` / ICE / 指纹；格式只列出 `111 opus/48000/2`，fmtp 为 `minptime=10;useinbandfec=1;stereo=1`，没有 offer 中的 PT 8 或 101。地址与端口已删除，完整未脱敏 SDP 不进入公开材料。这不是官方示例的 stdout，也不能证明已经收到媒体。

## 未测范围

Windows、真实麦克风或话机、实际 RTP 包交换、Track 锁定、公网、以及“加上 PCMA 能力之后官方示例会怎样”均未在本轮验收。不要把覆盖写成掌握。
