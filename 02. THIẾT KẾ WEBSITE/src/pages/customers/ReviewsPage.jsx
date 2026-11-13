import { useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import { reviews as reviewData } from '../../data/mockData.js';

export default function ReviewsPage() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const rows = useMemo(() => reviewData.filter((review) => `${review.customer} ${review.service}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 9));
  const pageRows = rows.slice((page - 1) * 9, page * 9);
  const columns = [
    { key: 'date', label: 'Thời gian đánh giá', width: '22%' },
    { key: 'customer', label: 'Họ và tên khách hàng', width: '25%', render: (review) => <button type="button" className="table-link" onClick={() => setSelected(review)}>{review.customer}</button> },
    { key: 'service', label: 'Tên dịch vụ thực hiện', width: '32%' },
    { key: 'stars', label: 'Mức đánh giá', width: '21%', render: (review) => (
      <span className="rating-stars" aria-label={`${review.stars} trên 5 sao`}>
        {Array.from({ length: 5 }, (_, index) => <Star key={index} size={17} fill={index < review.stars ? 'currentColor' : 'none'} />)}
      </span>
    ) },
  ];

  return (
    <div className="page-stack reviews-page">
      <PageHeader title="ĐÁNH GIÁ CỦA KHÁCH" />
      <div className="page-list-toolbar reviews-toolbar"><SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Nhập từ khóa cần tìm kiếm..." /></div>
      <section className="panel page-list-panel">
        <DataTable columns={columns} rows={pageRows} rowKey="id" emptyMessage="Không tìm thấy đánh giá phù hợp!" />
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </section>
      <Modal open={Boolean(selected)} title="CHI TIẾT ĐÁNH GIÁ" onClose={() => setSelected(null)} size="large">
        {selected && (
          <div className="review-detail">
            <dl className="detail-grid">
              <div><dt>Họ và tên khách hàng</dt><dd>{selected.customer}</dd></div>
              <div><dt>Tên dịch vụ</dt><dd>{selected.service}</dd></div>
              <div><dt>Thời gian đánh giá</dt><dd>{selected.date}</dd></div>
              <div><dt>Mức đánh giá</dt><dd className="rating-stars">{Array.from({ length: selected.stars }, (_, index) => <Star key={index} size={18} fill="currentColor" />)}</dd></div>
            </dl>
            <div className="review-detail__comment"><strong>Nội dung đánh giá chi tiết</strong><p>Dịch vụ thực hiện nhẹ nhàng, nhân viên tư vấn tận tình. Tôi hài lòng với kết quả sau buổi chăm sóc.</p></div>
            <div className="review-detail__photos"><div>Hình ảnh đánh giá</div><div>Ảnh</div><div>Ảnh</div><div>Ảnh</div></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
