import { useEffect, useMemo, useState } from 'react';
import { Image, Star } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import DataTable from '../../components/ui/DataTable.jsx';
import FeatureNotFound from '../../components/ui/FeatureNotFound.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import PageListToolbar from '../../components/ui/PageListToolbar.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import { apiList, apiRequest } from '../../api.js';

export default function ReviewsPage() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [reviewData, setReviewData] = useState([]);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const reviewId = pathname.replace(/^\/danh-gia\/?/, '').split('/').filter(Boolean)[0];
  const selected = selectedDetail ?? reviewData.find((review) => review.id === reviewId);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiList('/api/reviews')
      .then((rows) => { if (active) setReviewData(rows.map((review) => ({
        ...review,
        customer: review.customerName,
        service: review.serviceName || '—',
        stars: Number(review.rating),
        date: review.reviewedAt ? new Date(review.reviewedAt).toLocaleDateString('vi-VN') : '—',
        comment: review.content,
      }))); })
      .catch((error) => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setSelectedDetail(null);
    if (!reviewId) return () => { active = false; };
    apiRequest(`/api/reviews/${encodeURIComponent(reviewId)}`)
      .then((review) => { if (active) setSelectedDetail({
        ...review,
        customer: review.customerName,
        service: review.serviceName || '—',
        staff: review.staffName,
        stars: Number(review.rating),
        date: review.reviewedAt ? new Date(review.reviewedAt).toLocaleDateString('vi-VN') : '—',
        comment: review.content,
      }); })
      .catch((error) => { if (active) setLoadError(error.message); });
    return () => { active = false; };
  }, [reviewId]);

  const rows = useMemo(() => reviewData.filter((review) => `${review.customer} ${review.service} ${review.comment}`.toLowerCase().includes(query.toLowerCase())), [reviewData, query]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 9));
  const pageRows = rows.slice((page - 1) * 9, page * 9);
  if (loading) return <div className="panel data-loading" role="status">Đang tải đánh giá từ SQL…</div>;
  if (loadError && !reviewData.length) return <div className="panel data-error" role="alert">Không tải được đánh giá: {loadError}</div>;
  const columns = [
    { key: 'date', label: 'Thời gian đánh giá', width: '20%', align: 'center' },
    { key: 'customer', label: 'Họ và tên khách hàng', width: '26%', render: (review) => <button type="button" className="table-link" onClick={() => navigate(`/danh-gia/${review.id}`)}>{review.customer}</button> },
    { key: 'service', label: 'Tên dịch vụ thực hiện', width: '34%' },
    { key: 'stars', label: 'Mức đánh giá', width: '20%', align: 'center', render: (review) => (
      <span className="rating-stars" aria-label={`${review.stars} trên 5 sao`}>
        {Array.from({ length: 5 }, (_, index) => <Star key={index} size={17} fill={index < review.stars ? 'currentColor' : 'none'} />)}
      </span>
    ) },
  ];

  if (reviewId) {
    if (!selected) return <FeatureNotFound heading="ĐÁNH GIÁ CỦA KHÁCH" message="Không tìm thấy đánh giá phù hợp!" onBack={() => navigate('/danh-gia')} />;
    return (
      <div className="page-stack review-detail-page">
        <PageHeader
          title="CHI TIẾT ĐÁNH GIÁ"
          fallbackPath="/danh-gia"
          onBack={() => navigate('/danh-gia')}
        />
        <section className="panel review-detail-page__panel">
          <h2>Thông tin chung</h2>
          <dl className="review-detail-page__facts">
            <div><dt>Họ và tên khách hàng</dt><dd>{selected.customer}</dd></div>
            <div><dt>Số điện thoại</dt><dd>{selected.customerPhone || '—'}</dd></div>
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
              {selected.image ? <img className="review-detail-page__photo" src={selected.image} alt="Hình ảnh đánh giá" /> : <div className="review-detail-page__photo-placeholder"><Image aria-hidden="true" size={28} /><span>Chưa có hình ảnh</span></div>}
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
