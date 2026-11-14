import type { Metadata } from "next";
import { DEFAULT_SCORING_WEIGHTS } from "@/config/scoring";
import { DISCLAIMER } from "@/lib/copy";
import { HIGHLIGHT_RULE_DESCRIPTION } from "@/lib/domain/highlights";

export const metadata: Metadata = { title: "Cách DealHoi tính" };

export default function MethodPage() {
  const w = DEFAULT_SCORING_WEIGHTS;
  return (
    <article className="mx-auto max-w-3xl space-y-8 py-10 text-sm leading-relaxed [&_h2]:text-lg [&_h2]:font-bold [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
      <header>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Cách DealHoi thu thập và tính toán</h1>
        <p className="mt-3 text-ink-muted">{DISCLAIMER}</p>
      </header>
      <section>
        <h2>Nguồn dữ liệu</h2>
        <ul>
          <li>Mỗi thẻ và ưu đãi được nhập từ nguồn chính thức (ngân hàng hoặc đơn vị chấp nhận thanh toán), ghi lại đường dẫn nguồn và ngày xác minh.</li>
          <li>Chỉ ưu đãi đã được người kiểm duyệt xác minh mới được hiển thị. Ưu đãi hết hạn, bị rút lại hoặc chưa xác minh không được tính.</li>
          <li>Ưu đãi có ngày xác minh quá cũ được đánh dấu “cần xác minh lại”.</li>
          <li>AI không được dùng để tạo hay tìm kiếm ưu đãi.</li>
        </ul>
      </section>
      <section>
        <h2>Cách tính tiết kiệm</h2>
        <ul>
          <li>Hoàn tiền/giảm giá theo %: số tiền × tỷ lệ, sau đó áp dụng mức tối đa.</li>
          <li>Giảm giá cố định: tối đa bằng giá trị giao dịch.</li>
          <li>Giao dịch dưới mức tối thiểu của mỗi giao dịch sẽ bị loại.</li>
          <li>Nếu mức tối đa tính theo tháng/quý/chương trình, ước tính là “có điều kiện” vì DealHoi không biết hạn mức còn lại của bạn.</li>
          <li>Thông tin chưa rõ (mức tối đa, chi tiêu tối thiểu, phân loại cửa hàng) luôn được ghi là “chưa rõ”, không bao giờ được giả định bằng 0 hoặc không giới hạn.</li>
          <li>Điểm thưởng, voucher, trả góp và đặc quyền du lịch không được quy đổi thành tiền; các ưu đãi không được cộng dồn.</li>
        </ul>
      </section>
      <section>
        <h2>Điểm phù hợp lối sống</h2>
        <ul>
          <li>Khớp danh mục chi tiêu: {w.categoryAlignment}% · Đáp ứng điều kiện chi tiêu: {w.spendingConditions}% · Loại ưu đãi mong muốn: {w.rewardAlignment}% · Phí thường niên: {w.annualFee}%.</li>
          <li>Tiêu chí thiếu dữ liệu không được tính là phù hợp; khi đó điểm được ghi là “tạm tính”.</li>
          <li>Điểm chỉ phản ánh mức độ khớp giữa quyền lợi và thói quen chi tiêu bạn khai báo, không phải khả năng tín dụng hay xác suất được duyệt thẻ.</li>
        </ul>
      </section>
      <section>
        <h2>Quyền lợi nổi bật</h2>
        <p>{HIGHLIGHT_RULE_DESCRIPTION}</p>
      </section>
      <section>
        <h2>Trợ lý AI</h2>
        <ul>
          <li>Trợ lý chỉ nhận các bản ghi đã xác minh liên quan đến trang bạn đang xem và các phép tính của DealHoi.</li>
          <li>Câu trả lời được kiểm tra tự động: mọi con số và nguồn phải có trong dữ liệu đã cung cấp; câu trả lời không đạt sẽ không được hiển thị.</li>
        </ul>
      </section>
      <section>
        <h2>Sử dụng thẻ có trách nhiệm</h2>
        <p>Đừng chi tiêu nhiều hơn nhu cầu chỉ để nhận ưu đãi. Nếu không thanh toán đủ dư nợ, lãi suất và phí có thể lớn hơn mọi khoản hoàn tiền.</p>
      </section>
    </article>
  );
}
