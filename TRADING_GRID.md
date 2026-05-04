# Trading Grid Guide

Tài liệu này mô tả cách `TradingGrid` hoạt động end-to-end: từ UI canvas, xử lý data realtime, đến vòng đời lệnh bet.

## 1. Mục tiêu của Trading Grid

Trading Grid là một màn hình realtime cho phép người dùng:

- Xem chuyển động giá theo thời gian.
- Chọn một ô dự đoán (cell) để đặt lệnh bet.
- Theo dõi trạng thái lệnh: pending/open/settled, win/lose.
- Xem overlay chiến lược hoặc copy-trade.

## 2. Kiến trúc tổng thể

Các module chính:

- `src/features/trade/components/TradingGrid.tsx`
  - Điều phối toàn bộ: socket, store, animation loop, interaction binding.
- `src/features/trade/store.ts`
  - Zustand store chứa state nghiệp vụ (cells, bets, outcomes, history, balance...).
- `src/utils/gridLayout.ts`
  - Hệ tọa độ time/price <-> canvas pixel, cùng hit-test logic.
- `src/utils/canvasDraw.ts`
  - Các hàm vẽ thuần lên canvas (background, cell, line giá, trục).
- `src/hooks/useGridInteraction.ts`
  - Xử lý input user: pan, zoom, click-to-bet.

Nguyên tắc:

1. Parse và cập nhật data vào store trước.
2. Mỗi frame đọc store hiện tại và redraw toàn bộ canvas.
3. UI cell không dùng DOM element riêng, chỉ là pixel được vẽ theo state.

## 3. Vì sao dùng Canvas thay vì DOM

DOM approach:

- Mỗi cell là 1 node HTML.
- Khi dữ liệu realtime nhiều, số node lớn, repaint/reflow nặng.

Canvas approach:

- Chỉ 1 node `<canvas>`.
- Tự vẽ tất cả mỗi frame qua JS.
- Phù hợp với chart/grid realtime vì kiểm soát tốt hiệu năng.

Đổi lại, team phải tự quản lý:

- Tọa độ và layout.
- Hit-test khi click/touch.
- Render thứ tự lớp (background -> cells -> chart -> axis).

## 4. Data model cốt lõi

### 4.1 Cell

`CellData` (store) gồm:

- `id`: khóa cell (`startTs:endTs:lowerPrice:upperPrice`).
- `timeWindowStart`, `timeWindowEnd`: cửa sổ thời gian của ô.
- `priceLevel`: tâm vùng giá của ô.
- `multiplier`: reward rate hiển thị (`x`).
- `status`: `active | past | hit | lose`.
- `original`: dữ liệu gốc từ backend.

### 4.2 Bet state

- `pendingBets[cellId]`: lệnh vừa đặt, chờ backend xác nhận OPEN.
- `bets[cellId]`: lệnh đã OPEN.
- `pendingWins[cellId]`: payout tạm thời khi có tín hiệu win.
- `settledOutcomes[cellId]`: trạng thái settle cuối cùng (`isWin`, `payout`, `bonus`, ...).

### 4.3 Price state

- `history`: chuỗi điểm giá theo timestamp.
- `currentPrice`: giá mới nhất.
- `serverTimeOffset`: đồng bộ thời gian client với server.

## 5. Pipeline data: Socket -> Parse -> Store -> UI

### 5.1 Giá realtime (`price_now`)

1. Socket nhận payload (`number` hoặc object có `price`, `ts/time`).
2. Parse số hợp lệ.
3. Gọi `updatePrice(price, ts)`.
4. Store append `history`, cập nhật `currentPrice`.
5. Render loop đọc dữ liệu mới và vẽ line giá mượt.

### 5.2 Grid snapshot (`grid_update`)

1. Socket nhận payload (array trực tiếp hoặc bọc trong `data/grids`).
2. Parse thành `RemoteCell[]`.
3. Gọi `updateGrid(remoteCells)`.
4. Store lọc snapshot mới nhất, map sang `CellData`, merge với cell đang tracked state.
5. Frame tiếp theo vẽ grid/cell mới.

### 5.3 Order updates (`order_update`)

1. Socket nhận payload order.
2. `updateOrder(payload)` resolve `cellId`.
3. Cập nhật `pendingBets/bets/pendingWins/settledOutcomes` theo status `OPEN/SETTLED/WIN/LOSE/REJECTED`.
4. Cập nhật `cell.status` (`hit`/`lose`) khi đủ tín hiệu.
5. Canvas đổi style ô ngay ở frame kế tiếp.

### 5.4 Overlay updates

- Follow trade events -> parse activity -> map cell -> highlight cell overlay.
- Suggested strategy update -> parse danh sách cell -> highlight overlay.

## 6. Render loop (requestAnimationFrame)

Trong `TradingGrid`:

1. Mỗi frame cập nhật `nowRef` theo `Date.now() + serverTimeOffset`.
2. Nội suy giá hiển thị (`priceMotionRef`, easing) để line di chuyển mượt giữa các tick.
3. Gọi `computeLayout(...)` để có converter tọa độ.
4. Vẽ theo thứ tự:
   - `drawBackgroundGrid`
   - `drawBetCells`
   - `drawPriceLine`
   - `drawPriceAxis`
   - `drawTimeAxis`
   - `drawZoomIndicator`

Lưu ý:

- Canvas luôn redraw cả khung hình.
- Không patch từng cell như DOM.

## 7. Cách layout grid hoạt động

`computeLayout` tạo hệ quy chiếu thống nhất:

- Trục X: thời gian.
- Trục Y: giá.
- Cell giữ dạng vuông (`cellW = cellH`) theo zoom.
- Có các hàm converter:
  - `toCanvasX(time)` / `toCanvasY(price)` để vẽ.
  - `toTime(x)` / `toPrice(y)` để hit-test.

Nhờ đó:

- Background grid khớp chính xác với cell business.
- Zoom/pan thay đổi mượt vì chỉ đổi transform và redraw.

## 8. Vẽ cell theo trạng thái

`drawBetCells` quyết định style từng ô:

- Preview (hover hợp lệ): `_drawPreviewCell`.
- Overlay strategy/follow: `_drawCopyTradeCell`.
- Bet đang mở: `_drawBetBadge`.
- Win: `_drawWinCell`.
- Lose: `_drawLoseCell`.
- Plain cell: text multiplier + corner dots.

Thông tin hiển thị chính:

- Multiplier (`rewardRate`) dạng `x`.
- Amount/payout (WLD và USD xấp xỉ khi có giá quy đổi).
- Border/glow/color phản ánh trạng thái nghiệp vụ.

## 9. Interaction: pan, zoom, click-to-bet

`useGridInteraction` xử lý:

- Wheel zoom (desktop), pinch zoom (mobile).
- Drag pan.
- Click đặt lệnh.

### 9.1 Hit-test

Khi click:

1. Đổi tọa độ chuột sang time/price.
2. Tìm cell chứa điểm đó.
3. Check điều kiện bet:
   - Cell ở tương lai.
   - Không trong closing window 5 giây.
   - Chưa có bet/pending bet.
4. Nếu hợp lệ, gọi `placeBet` và flow phát lệnh socket.

### 9.2 Toast phản hồi

Nếu click ô không hợp lệ:

- Đã có lệnh trên ô.
- Ô đã đóng hoặc sắp đóng.
- Hoặc không thể mở trade.

## 10. Vòng đời lệnh bet

1. User click cell hợp lệ.
2. Local state tạo `pendingBets[cellId]` (phản hồi UI ngay).
3. Backend xác nhận `OPEN` -> chuyển sang `bets[cellId]`.
4. Khi hết cửa sổ hoặc có kết quả:
   - `SETTLED/WIN/LOSE` cập nhật `settledOutcomes`.
   - Cell đổi `status` thành `hit` hoặc `lose`.
5. Win effect/overlay share card hiển thị nếu là lệnh thắng.

## 11. Đồng bộ thời gian và độ mượt

- `serverTimeOffset` được blend chậm để tránh giật trục thời gian.
- `buildDisplayHistory` thêm điểm nội suy cuối cho line giá.
- `checkWinEffects` chạy nhịp nhanh để trạng thái ô đổi sát thời điểm chart head đi qua.

## 12. Mapping nhanh function -> trách nhiệm

- `updatePrice`: cập nhật giá/historic point.
- `updateGrid`: cập nhật snapshot grid cell.
- `updateOrder`: cập nhật trạng thái lệnh.
- `checkWinEffects`: đồng bộ status cell theo thời gian chart.
- `computeLayout`: tính hệ tọa độ.
- `drawBackgroundGrid`: vẽ nền lưới.
- `drawBetCells`: vẽ cell nghiệp vụ.
- `drawPriceLine`: vẽ line giá.
- `hitTestCell`: xác định cell có thể bet tại điểm click.

## 13. Lưu ý cho dev khi mở rộng

1. Khi thêm style cell mới, ưu tiên mở rộng `drawBetCells` + helper draw tương ứng.
2. Không nhét logic nghiệp vụ vào `canvasDraw.ts`; file này nên giữ càng thuần render càng tốt.
3. Nếu thêm event socket mới, parse tại `TradingGrid.tsx`, cập nhật state qua action trong `store.ts`.
4. Tránh đọc React state trực tiếp trong rAF loop; dùng ref snapshot như hiện tại.
5. Mọi thay đổi rule bet nên đồng bộ cả `hitTestCell` và message phản hồi click.

## 14. Debug checklist

- Cell không hiện:
  - Check `grid_update` payload parse ra `RemoteCell[]` chưa.
  - Check `updateGrid` có tạo `CellData` hợp lệ không.
- Click không bet được:
  - Check `hitTestCell` (future/closing window/hasBet).
- Win/lose hiển thị sai:
  - Check `order_update` payload có đủ `cellId`, `status`, payout fields.
  - Check `checkWinEffects` đang được loop gọi đều.
- Grid giật:
  - Check `serverTimeOffset` và cadence nội suy giá.

---

Tài liệu này nên được cập nhật cùng lúc khi thay đổi:

- Shape payload socket.
- Rule eligibility đặt lệnh.
- Cơ chế trạng thái cell hoặc draw pipeline.
