# SiaTube API Documentation

このドキュメントは `comment/index.js`, `video/index.js`, `search/index.js`, `channel/index.js`, `suggest/index.js`, `playlist/index.js`, `stream-url/index.js` の実装と nginx の公開パスをもとにした API 仕様です。

## Base URLs

| API | Process name | File | Public path |
|---|---|---|---|
| Comments | `comment-api` | `comment/index.js` | `/api/comment`, `/api/comments` |
| Video | `video-api` | `video/index.js` | `/api/video/` |
| Search | `search-api` | `search/index.js` | `/api/search`, `/api/search/` |
| Channel | `channel-api` | `channel/index.js` | `/api/channel/` |
| Suggest | `suggest-api` | `suggest/index.js` | `/api/suggest/` |
| Playlist | `playlist-api` | `playlist/index.js` | `/api/playlist/` |
| Stream | `stream-api` | `stream-url/index.js` | `/api/stream/` |

## 共通事項

- 通常レスポンスは JSON です。`raw=true` でHTML全文を返す場合だけ `text/html` になります。
- YouTube 側の HTML / Innertube レスポンス構造に依存しているため、YouTube の仕様変更でフィールドが `null`, 空文字, 空配列になる場合があります。
- サムネイルは API によって URL の場合と `data:image/...;base64,...` の場合があります。
- 継続取得は各レスポンス内の `nextContinuationToken`, `nextContinuation`, `nextToken`, `continuationToken` を次回リクエストの `token` または `continuation` に渡します。

### Raw response mode

YouTubeレスポンスを解析するAPIでは、クエリに `raw=true` を付けると通常の整形処理を行わず、YouTubeから取得したレスポンス全文を返します。

| Endpoint | Raw response |
|---|---|
| `/api/comments` | コメント取得用 Innertube JSON |
| `/api/comment/replies` | 返信取得用 Innertube JSON |
| `/api/video/:id` | 初回取得はYouTube HTML、`token`指定時は Innertube JSON |
| `/api/search` | 検索用 Innertube JSON |
| `/api/channel/:id` | チャンネル取得用 Innertube JSON |
| `/api/playlist/:id` | 通常プレイリストは Innertube JSON、RDプレイリストはYouTube HTML。複数ID指定時はレスポンス全文の配列 |

Example:

```bash
curl 'https://siatube.com/api/search?q=猫&raw=true'
```

## comment-api

Base URL: `https://siatube.com`

### GET `/api/comments`

Public aliases: `/api/comment`, `/api/comment/comments`

動画コメントを取得します。初回取得では `videoId` と任意の `sort` を指定します。次ページ取得では `continuation` を指定します。

Query:

| Name | Required | Description |
|---|---:|---|
| `videoId` | yes | YouTube 動画 ID |
| `sort` | no | `top` または `new`。省略時は `top` |
| `continuation` | no | 次ページ用トークン。指定時は `sort` より優先 |
| `raw` | no | `true` で Innertube JSON 全文を返す |

Examples:

```bash
curl 'https://siatube.com/api/comments?videoId=dQw4w9WgXcQ'
curl 'https://siatube.com/api/comments?videoId=dQw4w9WgXcQ&sort=new'
curl 'https://siatube.com/api/comments?videoId=dQw4w9WgXcQ&continuation=CONTINUATION_TOKEN'
```

Response example:

```json
{
  "success": true,
  "mode": "initial",
  "videoId": "dQw4w9WgXcQ",
  "sort": "top",
  "continuation": "COMMENT_SORT_TOKEN",
  "nextContinuation": "NEXT_COMMENTS_TOKEN",
  "fetchedAt": "2026-06-14T08:00:00.000Z",
  "totalComments": 2,
  "comments": [
    {
      "entityKey": "comment-entity-key",
      "commentId": "Ugx...",
      "text": "コメント本文",
      "publishedTime": "1 年前",
      "replyLevel": 0,
      "author": {
        "channelId": "UC...",
        "name": "User Name",
        "avatar": "https://yt3.ggpht.com/...",
        "verified": false,
        "creator": false,
        "artist": false
      },
      "likes": {
        "text": "123",
        "count": 123
      },
      "replies": {
        "text": "5",
        "count": 5
      },
      "toolbar": {
        "likeCountA11y": "123 件の高評価",
        "replyCountA11y": "5 件の返信",
        "stateKey": "toolbar-state-key"
      },
      "replyContinuation": "REPLIES_TOKEN"
    }
  ]
}
```

Errors:

```json
{ "error": "videoId is required" }
```

```json
{ "error": "Internal server error" }
```

### GET `/api/comment/replies`

コメントの返信一覧を取得します。`replyContinuation` を `/api/comments` のコメントから取得して渡します。

Query:

| Name | Required | Description |
|---|---:|---|
| `videoId` | yes | YouTube 動画 ID |
| `continuation` | yes | 返信取得用 continuation token |
| `raw` | no | `true` で Innertube JSON 全文を返す |

Example:

```bash
curl 'https://siatube.com/api/comment/replies?videoId=dQw4w9WgXcQ&continuation=REPLIES_TOKEN'
```

Response example:

```json
{
  "success": true,
  "videoId": "dQw4w9WgXcQ",
  "continuation": "REPLIES_TOKEN",
  "nextContinuation": "NEXT_REPLIES_TOKEN",
  "fetchedAt": "2026-06-14T08:00:00.000Z",
  "totalReplies": 1,
  "replies": [
    {
      "commentId": "Ugy...",
      "text": "返信本文",
      "publishedTime": "2 か月前",
      "replyLevel": 1,
      "author": {
        "channelId": "UC...",
        "name": "Reply User",
        "avatar": "https://yt3.ggpht.com/...",
        "verified": false,
        "creator": false,
        "artist": false
      },
      "likes": {
        "text": "10",
        "count": 10
      },
      "replies": {
        "text": "0",
        "count": 0
      },
      "replyContinuation": null
    }
  ]
}
```

### GET `/api/comment/raw`

YouTube Innertube の raw response を返します。デバッグ用途です。

Query:

| Name | Required | Description |
|---|---:|---|
| `videoId` | yes | YouTube 動画 ID |
| `continuation` | yes | continuation token |

Example:

```bash
curl 'https://siatube.com/api/comment/raw?videoId=dQw4w9WgXcQ&continuation=TOKEN'
```

Response: YouTube から返った JSON をそのまま返します。

## video-api

Base URL: `https://siatube.com`

### GET `/api/video/:id`

動画詳細と関連動画を取得します。

Path:

| Name | Required | Description |
|---|---:|---|
| `id` | yes | YouTube 動画 ID。独自形式で `token` や `depth` を埋め込むことも可能 |

Query:

| Name | Required | Description |
|---|---:|---|
| `token` | no | 関連動画の追加取得用 continuation token |
| `depth` | no | `2` 指定時、初回ロード時に関連動画を追加取得 |
| `raw` | no | `true` で初回はYouTube HTML全文、`token`指定時は Innertube JSON 全文を返す |

Supported parameter styles:

- Standard: `/api/video/dQw4w9WgXcQ?token=TOKEN`
- Embedded: `/api/video/dQw4w9WgXcQ====token==i==TOKEN==p==depth==i==2`
- Embedded: `/api/video/dQw4w9WgXcQ&token=TOKEN&depth=2`
- Embedded: `/api/video/dQw4w9WgXcQ==p==token==i==TOKEN`

Examples:

```bash
curl 'https://siatube.com/api/video/dQw4w9WgXcQ'
curl 'https://siatube.com/api/video/dQw4w9WgXcQ?depth=2'
curl 'https://siatube.com/api/video/dQw4w9WgXcQ?token=CONTINUATION_TOKEN'
```

Initial response example:

```json
{
  "id": "dQw4w9WgXcQ",
  "title": "Video title",
  "views": "1.6億 回視聴",
  "relativeDate": "14 年前",
  "likes": "高評価 100万",
  "thumbnail": "data:image/jpeg;base64,...",
  "author": {
    "id": "UC...",
    "name": "Channel Name",
    "subscribers": "登録者数 100万人",
    "thumbnail": "https://yt3.ggpht.com/...",
    "collaborator": false,
    "collaborators": []
  },
  "description": {
    "text": "説明文\n2行目",
    "formatted": "説明文<br>2行目",
    "run0": "説明文",
    "run1": "2行目",
    "run2": "",
    "run3": ""
  },
  "Related-videos": {
    "relatedCount": 1,
    "nextContinuationToken": "NEXT_RELATED_TOKEN",
    "relatedVideos": [
      {
        "type": "video",
        "videoId": "abc123def45",
        "title": "Related video title",
        "channelName": "Related Channel",
        "viewCountText": "10万 回視聴",
        "publishedTimeText": "1 年前",
        "duration": "3:21",
        "badge": null,
        "thumbnails": [
          { "url": "data:image/jpeg;base64,..." }
        ],
        "thumbnail": "data:image/jpeg;base64,...",
        "channelAvatar": "",
        "playlistId": null,
        "overlayIcon": null
      }
    ]
  },
  "extended_stats": {
    "views_original": "160,000,000 回視聴",
    "views_short": "1.6億 回視聴",
    "date_simple": "2009/10/25",
    "date_relative_label": "14 年前"
  },
  "extended_badges": [],
  "extended_superTitle": "",
  "trackingParams": "..."
}
```

Continuation response example:

```json
{
  "id": "dQw4w9WgXcQ",
  "title": "",
  "Related-videos": {
    "relatedCount": 1,
    "nextContinuationToken": "NEXT_RELATED_TOKEN",
    "relatedVideos": [
      {
        "type": "playlist",
        "videoId": "abc123def45",
        "title": "More related content",
        "channelName": "Channel",
        "viewCountText": "5万 回視聴",
        "publishedTimeText": "2 週間前",
        "duration": "12:00",
        "badge": null,
        "thumbnails": [
          { "url": "data:image/jpeg;base64,..." }
        ],
        "thumbnail": "data:image/jpeg;base64,...",
        "channelAvatar": "",
        "playlistId": "PL..."
      }
    ]
  }
}
```

Unavailable response example:

```json
{
  "id": "dQw4w9WgXcQ",
  "unavailable": true,
  "reason": "Failed to extract data",
  "Related-videos": {
    "relatedVideos": []
  }
}
```

## search-api

Base URL: `https://siatube.com`

### GET `/api/search`

Alias: `/api/search/:q`

YouTube 検索結果を取得します。初回検索は `q`、次ページ以降は `token` を使います。

Query / Path:

| Name | Required | Description |
|---|---:|---|
| `q` | conditional | 検索語。`token` が無い場合は必須 |
| `token` | conditional | 次ページ用 continuation token。指定時は `q` なしでも可 |
| `raw` | no | `true` で Innertube JSON 全文を返す |

Examples:

```bash
curl 'https://siatube.com/api/search?q=猫'
curl 'https://siatube.com/api/search/猫'
curl 'https://siatube.com/api/search?token=CONTINUATION_TOKEN'
```

Response example:

```json
{
  "items": [
    {
      "type": "video",
      "videoId": "abc123def45",
      "title": "Video title",
      "thumbnails": [
        {
          "url": "https://i.ytimg.com/vi/abc123def45/hqdefault.jpg",
          "width": 360,
          "height": 202
        }
      ],
      "duration": "10:01",
      "badges": ["公式"],
      "viewCounts": {
        "full": "1,234 回視聴",
        "short": "1234 回視聴",
        "raw": "1234"
      },
      "publishedTime": "1 日前",
      "playlistId": null,
      "channelId": "UC...",
      "channelName": "Channel Name",
      "channelIcons": [],
      "channelBadges": []
    },
    {
      "type": "channel",
      "channelId": "UC...",
      "channelName": "Channel Name",
      "handle": "@handle",
      "channelIcons": [],
      "description": "チャンネル説明",
      "subscriberCount": "登録者数 10万人",
      "videoCount": "100 本",
      "badges": []
    },
    {
      "type": "playlist",
      "videoId": "abc123def45",
      "title": "Playlist title",
      "thumbnails": [],
      "duration": "",
      "badges": [],
      "viewCounts": {
        "full": "",
        "short": "",
        "raw": ""
      },
      "publishedTime": "",
      "playlistId": "PL...",
      "channelId": "UC...",
      "channelName": "Channel Name",
      "channelIcons": [],
      "channelBadges": []
    }
  ],
  "continuationToken": "NEXT_SEARCH_TOKEN",
  "estimatedResults": "12345",
  "targetId": "search-feed"
}
```

Errors:

```json
{
  "error": "Bad Request",
  "message": "query parameter 'q' or 'token' is required"
}
```

```json
{
  "error": "Bad Gateway",
  "message": "Failed to fetch data from upstream service."
}
```

## channel-api

Base URL: `https://siatube.com`

### GET `/api/channel/:id`

チャンネル情報、トップ動画、チャンネル内プレイリストセクションを取得します。

Path:

| Name | Required | Description |
|---|---:|---|
| `id` | yes | YouTube チャンネル ID。通常は `UC...` |

Query:

| Name | Required | Description |
|---|---:|---|
| `raw` | no | `true` で Innertube JSON 全文を返す |

Example:

```bash
curl 'https://siatube.com/api/channel/UCxxxxxxxxxxxxxxxxxxxxxx'
```

Response example:

```json
{
  "channelId": "UCxxxxxxxxxxxxxxxxxxxxxx",
  "title": "Channel Name",
  "avatar": "https://yt3.ggpht.com/...",
  "banner": "https://yt3.googleusercontent.com/...",
  "videoCount": "100 本の動画",
  "description": "チャンネル説明",
  "topVideo": {
    "title": "Top video title",
    "videoId": "abc123def45",
    "viewCount": "1万 回視聴",
    "published": "1 日前",
    "description": "動画説明<br>2行目",
    "thumbnail": "data:image/webp;base64,..."
  },
  "playlists": [
    {
      "title": "Uploads",
      "playlistId": "UUxxxxxxxxxxxxxxxxxxxxxx",
      "items": [
        {
          "videoId": "abc123def45",
          "title": "Video title",
          "duration": "10:00",
          "published": "1 日前",
          "author": "Channel Name",
          "viewCount": "1万 回視聴",
          "thumbnail": "data:image/webp;base64,...",
          "icon": "https://yt3.ggpht.com/..."
        }
      ]
    }
  ],
  "uploadsPlaylistId": "UUxxxxxxxxxxxxxxxxxxxxxx"
}
```

Errors:

```json
{ "error": "YouTube APIがまだ初期化されていません" }
```

```json
{ "error": "チャンネル情報の取得中にエラーが発生しました" }
```

## suggest-api

Base URL: `https://siatube.com`

### GET `/api/suggest`

Path variant: `/api/suggest/:keyword`

Google Suggest の YouTube サジェストを取得します。

Query / Path:

| Name | Required | Description |
|---|---:|---|
| `keyword` | yes | サジェスト元の検索語 |

Examples:

```bash
curl 'https://siatube.com/api/suggest/?keyword=猫'
curl 'https://siatube.com/api/suggest/猫'
```

Response example:

```json
[
  "猫",
  "猫ミーム",
  "猫 動画",
  "猫 鳴き声"
]
```

Errors:

```json
{ "error": "keywordクエリが必要です" }
```

```json
{ "error": "JSONの解析に失敗しました" }
```

```json
{ "error": "外部リクエストでエラーが発生しました" }
```

## playlist-api

Base URL: `https://siatube.com`

### GET `/api/playlist/:id`

YouTube プレイリスト情報と動画一覧を取得します。チャンネル ID `UC...` を渡すとアップロードプレイリスト `UU...` に変換します。`====` で複数 ID を指定すると、複数プレイリストをマージして公開日時順に並べます。

Path:

| Name | Required | Description |
|---|---:|---|
| `id` | yes | Playlist ID, Channel ID, RD playlist ID, または `====` 区切りの複数 ID |

Query:

| Name | Required | Description |
|---|---:|---|
| `token` | no | 通常プレイリストの次ページ用 token |
| `v` | conditional | `RD...` プレイリストで必須の動画 ID |
| `raw` | no | `true` で通常は Innertube JSON 全文、RDはYouTube HTML全文を返す |

Supported parameter styles:

- Standard: `/api/playlist/PL...?token=TOKEN`
- RD playlist: `/api/playlist/RD...?v=VIDEO_ID`
- Channel uploads: `/api/playlist/UCxxxxxxxxxxxxxxxxxxxxxx`
- Multiple IDs: `/api/playlist/UU...====PL...`
- Embedded: `/api/playlist/PL...==p==token==i==TOKEN`
- Embedded: `/api/playlist/PL...&token=TOKEN`

Examples:

```bash
curl 'https://siatube.com/api/playlist/PLxxxxxxxxxxxxxxxx'
curl 'https://siatube.com/api/playlist/UCxxxxxxxxxxxxxxxxxxxxxx'
curl 'https://siatube.com/api/playlist/RDxxxxxxxxxxx?v=dQw4w9WgXcQ'
curl 'https://siatube.com/api/playlist/PLxxxxxxxxxxxxxxxx?token=NEXT_TOKEN'
curl 'https://siatube.com/api/playlist/UUxxxxxxxxxxxxxxxxxxxxxx====PLyyyyyyyyyyyyyyyy'
```

Normal response example:

```json
{
  "playlistId": "PLxxxxxxxxxxxxxxxx",
  "title": "Playlist title",
  "author": "Channel Name",
  "description": "Playlist description",
  "responseItems": "2",
  "totalItems": "100本",
  "url": "https://www.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxx",
  "lastUpdated": "2026/06/14",
  "views": "1,234 回視聴",
  "items": [
    {
      "videoId": "abc123def45",
      "title": "Video title",
      "duration": "10:00",
      "published": "1 日前",
      "author": "Channel Name",
      "viewCount": "1万 回視聴",
      "thumbnail": "data:image/webp;base64,...",
      "icon": "https://yt3.ggpht.com/..."
    }
  ],
  "nextToken": "NEXT_PLAYLIST_TOKEN"
}
```

Merged response example:

```json
{
  "playlistId": "UUxxxxxxxxxxxxxxxxxxxxxx,PLyyyyyyyyyyyyyyyy",
  "title": "",
  "author": "Multiple Channels",
  "description": "Merged Playlist",
  "responseItems": "2",
  "totalItems": "2 本",
  "url": "",
  "lastUpdated": "2026-06-14T08:00:00.000Z",
  "views": null,
  "items": [
    {
      "videoId": "abc123def45",
      "title": "Video title",
      "duration": "10:00",
      "published": "1 日前",
      "author": "Channel Name",
      "viewCount": "1万 回視聴",
      "thumbnail": "data:image/webp;base64,...",
      "icon": "https://yt3.ggpht.com/..."
    }
  ],
  "nextToken": null
}
```

RD playlist response example:

```json
{
  "playlistId": "RDxxxxxxxxxxx",
  "title": "Mix",
  "author": "",
  "description": "",
  "responseItems": "25",
  "totalItems": "25本",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDxxxxxxxxxxx",
  "lastUpdated": "",
  "views": "",
  "items": [
    {
      "videoId": "abc123def45",
      "title": "Mix item title",
      "duration": "3:30",
      "published": "",
      "author": "Channel Name",
      "viewCount": "",
      "thumbnail": "data:image/webp;base64,...",
      "icon": ""
    }
  ],
  "nextToken": null
}
```

Errors:

```json
{ "error": "RD プレイリストには v パラメータが必要です" }
```

```json
{ "error": "エラーメッセージ" }
```

## stream-api

Base URL: `https://siatube.com`

### GET `/api/stream/:videoid`

YouTube の動画 ID を受け取り、再生URL、動画・音声ストリーム、HLS、字幕情報を返します。

Path:

| Name | Required | Description |
|---|---:|---|
| `videoid` | yes | `[A-Za-z0-9_-]` で構成された11文字の YouTube 動画 ID |

Example:

```bash
curl 'https://siatube.com/api/stream/v7fqWQ0BPfw'
```

成功時はキャッシュ状態を示す `X-Stream-Cache` レスポンスヘッダーが返ります。

| Value | Description |
|---|---|
| `MISS` | 上流workerから新規取得 |
| `HIT` | メモリキャッシュから取得 |
| `INFLIGHT` | 同じ動画IDの進行中リクエストを共有 |

Response outline:

```json
{
  "id": "v7fqWQ0BPfw",
  "title": "Video title",
  "hasM3u8": true,
  "hasSubtitles": true,
  "hasAutomaticCaptions": true,
  "counts": {
    "total": 10,
    "muxed": 1,
    "videoOnly": 3,
    "audioOnly": 2,
    "m3u8": 2,
    "manualSubtitles": 1,
    "automaticCaptions": 1
  },
  "streams": {
    "muxed": [],
    "videoOnly": [],
    "audioByLanguage": {}
  },
  "m3u8": {
    "list": [],
    "byLanguage": {}
  },
  "subtitles": {
    "manualByLanguage": {},
    "automaticByLanguage": {}
  }
}
```

Errors:

```json
{
  "error": "Bad Request",
  "message": "videoid must be an 11-character YouTube video ID"
}
```

```json
{
  "error": "Bad Gateway",
  "message": "Upstream server request failed"
}
```

### GET `/api/stream/dashboard/status`

worker、処理中リクエスト、キャッシュの状態をJSONで返します。

### GET `/api/stream/dashboard`

同じ稼働状況をHTMLダッシュボードで表示します。

ダッシュボードの2エンドポイントは `ENABLE_DASHBOARD=true` の場合だけ有効です。`DASHBOARD_TOKEN` を設定した場合は、`Authorization: Bearer TOKEN` または `?token=TOKEN` が必要です。

詳細なレスポンスフィールドは `stream-url/STREAM_URL_API.md` を参照してください。
