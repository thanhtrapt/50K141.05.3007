import { useMemo, useState } from 'react';
import { Image, Star } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import FeatureNotFound from '../../components/ui/FeatureNotFound.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import PageListToolbar from '../../components/ui/PageListToolbar.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import { customers, reviews as reviewData } from '../../data/mockData.js';

export default function ReviewsPage() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const reviewId = pathname.replace(/^\/danh-gia\/?/, '').split('/').filter(Boolean)[0];
  const selected = reviewData.find((review) => review.id === reviewId);
  const rows = useMemo(() => reviewData.filter((review) => `${review.customer} ${review.service}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 9));
  const pageRows = rows.slice((page - 1) * 9, page * 9);
  const columns = [
    { key: 'date', label: 'Thời gian đánh giá', width: '22%' },
    { key: 'customer', label: 'Họ và tên khách hàng', width: '25%', render: (review) => <button type="button" className="table-link" onClick={() => navigate(`/danh-gia/${review.id}`)}>{review.customer}</button> },
    { key: 'service', label: 'Tên dịch vụ thực hiện', width: '32%' },
    { key: 'stars', label: 'Mức đánh giá', width: '21%', render: (review) => (
      <span className="rating-stars" aria-label={`${review.stars} trên 5 sao`}>
        {Array.from({ length: 5 }, (_, index) => <Star key={index} size={17} fill={index < review.stars ? 'currentColor' : 'none'} />)}
      </span>
    ) },
  ];

  if (reviewId) {
    if (!selected) return <FeatureNotFound heading="ĐÁNH GIÁ CỦA KHÁCH" message="Không tìm thấy đánh giá phù hợp!" onBack={() => navigate('/danh-gia')} />;
    const customer = customers.find((item) => item.name === selected.customer);
    return (
      <div className="page-stack review-detail-page">
        <PageHeader title="CHI TIẾT ĐÁNH GIÁ" actions={<Button variant="secondary" onClick={() => navigate('/danh-gia')}>Quay lại danh sách</Button>} />
        <section className="panel review-detail-page__panel">
          <h2>Thông tin chung</h2>
          <dl className="review-detail-page__facts">
            <div><dt>Họ và tên khách hàng</dt><dd>{selected.customer}</dd></div>
            <div><dt>Số điện thoại</dt><dd>{customer?.phone || '—'}</dd></div>
            <div><dt>Tên dịch vụ thực hiện</dt><dd>{selected.service}</dd></div>
            <div><dt>Tên nhân viên thực hiện</dt><dd>{selected.staff || '—'}</dd></div>
            <div><dt>Mức đánh giá</dt><dd className="rating-stars">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={18} fill={index < selected.stars ? 'currentColor' : 'none'} />)}<span>{selected.stars}/5</span></dd></div>
            <div><dt>Thời gian đánh giá</dt><dd>{selected.date}</dd></div>
          </dl>
          <section className="review-detail-page__comment">
            <h3>Nội dung đánh giá chi tiết</h3>
            <p>{selected.comment || 'Dịch vụ thực hiện nhẹ nhàng, nhân viên tư vấn tận tình. Tôi hài lòng với kết quả sau buổi chăm sóc.'}</p>
          </section>
          <section className="review-detail-page__photos">
            <h3>Hình ảnh đánh giá</h3>
            <div className="review-detail-page__photo-grid">
              {Array.from({ length: 4 }, (_, index) => <div className="review-detail-page__photo-placeholder" key={index}><Image aria-hidden="true" size={28} /></div>)}
            </div>
          </section>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack reviews-page">
      <PageHeader title="ĐÁNH GIÁ CỦA KHÁCH" />
      <PageListToolbar
        className="reviews-toolbar"
        search={<SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Nhập từ khóa cần tìm kiếm..." />}
      />
      <section className="panel page-list-panel">
        <DataTable columns={columns} rows={pageRows} rowKey="id" emptyMessage="Không tìm thấy đánh giá phù hợp!" />
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </section>
    </div>
  );
}
