BEGIN;

CREATE OR REPLACE FUNCTION public.fn_tao_don_mua_dich_vu(
  p_makhachhang text,
  p_madichvu text,
  p_dathanhtoan boolean,
  p_ghichu text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account char(10);
  v_order_id char(10);
  v_session_id char(10);
  v_order_number bigint;
  v_session_number bigint;
  v_service_sessions integer;
  v_template_count integer;
  v_template record;
BEGIN
  SELECT matk INTO v_account
  FROM public.taikhoan
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  IF v_account IS NULL THEN
    RAISE EXCEPTION 'Tài khoản chưa được liên kết với Supabase Auth.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.khachhang WHERE makhachhang = btrim(p_makhachhang)) THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ khách hàng.';
  END IF;
  SELECT tongsobuoi INTO v_service_sessions
  FROM public.dichvu
  WHERE madichvu = btrim(p_madichvu);
  IF v_service_sessions IS NULL OR v_service_sessions <= 0 THEN
    RAISE EXCEPTION 'Không tìm thấy dịch vụ hoặc dịch vụ chưa có buổi thực hiện.';
  END IF;
  SELECT count(*) INTO v_template_count
  FROM public.ct_dichvu
  WHERE madichvu = btrim(p_madichvu);
  IF v_template_count <> v_service_sessions THEN
    RAISE EXCEPTION 'Cấu hình số buổi của dịch vụ chưa khớp chi tiết buổi.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('rpc_donmuadv_ma'));
  SELECT coalesce(max(right(rtrim(madonmua), 7)::bigint), 0) + 1 INTO v_order_number
  FROM public.donmuadv
  WHERE rtrim(madonmua) ~ '^LHD[0-9]{7}$';
  v_order_id := ('LHD' || lpad(v_order_number::text, 7, '0'))::char(10);

  INSERT INTO public.donmuadv
    (madonmua, ngaymua, trangthaithanhtoan, trangthaihoanthanh, filetonghop,
     sobuoidathuchien, ghichu, madichvu, makhachhang)
  VALUES
    (v_order_id, current_timestamp,
     CASE WHEN coalesce(p_dathanhtoan, false) THEN 'Đã thanh toán' ELSE 'Chưa thanh toán' END,
     'Chưa thực hiện', NULL, 0, nullif(btrim(p_ghichu), ''), btrim(p_madichvu), btrim(p_makhachhang));

  PERFORM pg_advisory_xact_lock(hashtext('rpc_ct_donmua_ma'));
  SELECT coalesce(max(right(rtrim(mact_donmua), 8)::bigint), 0) + 1 INTO v_session_number
  FROM public.ct_donmua
  WHERE rtrim(mact_donmua) ~ '^CM[0-9]{8}$';
  FOR v_template IN
    SELECT tenbuoi, mact_dichvu
    FROM public.ct_dichvu
    WHERE madichvu = btrim(p_madichvu)
    ORDER BY mact_dichvu
  LOOP
    v_session_id := ('CM' || lpad(v_session_number::text, 8, '0'))::char(10);
    INSERT INTO public.ct_donmua
      (mact_donmua, tenbuoi, trangthaithuchien, xacnhankh, madonmua, mact_dichvu)
    VALUES
      (v_session_id, v_template.tenbuoi, 'Chưa thực hiện', 'Chưa xác nhận', v_order_id, v_template.mact_dichvu);
    v_session_number := v_session_number + 1;
  END LOOP;

  RETURN rtrim(v_order_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_ghi_nhan_ban(
  p_makhachhang text,
  p_items jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account char(10);
  v_sale_id char(10);
  v_sale_number bigint;
  v_line_number bigint;
  v_item jsonb;
  v_product_id char(10);
  v_quantity integer;
  v_unit_price numeric;
  v_stock integer;
  v_lot record;
  v_take integer;
  v_remaining integer;
  v_line_id char(10);
  v_total numeric := 0;
BEGIN
  SELECT matk INTO v_account
  FROM public.taikhoan
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  IF v_account IS NULL THEN
    RAISE EXCEPTION 'Tài khoản chưa được liên kết với Supabase Auth.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.khachhang WHERE makhachhang = btrim(p_makhachhang)) THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ khách hàng.';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Vui lòng chọn ít nhất một sản phẩm.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) AS row(item)
    GROUP BY btrim(row.item->>'mamypham') HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Sản phẩm đã được chọn nhiều lần.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('rpc_donghinhanban_ma'));
  SELECT coalesce(max(right(rtrim(madon), 7)::bigint), 0) + 1 INTO v_sale_number
  FROM public.donghinhanban
  WHERE rtrim(madon) ~ '^PNB[0-9]{7}$';
  v_sale_id := ('PNB' || lpad(v_sale_number::text, 7, '0'))::char(10);

  PERFORM pg_advisory_xact_lock(hashtext('rpc_ct_donban_ma'));
  SELECT coalesce(max(right(rtrim(mact_don), 8)::bigint), 0) + 1 INTO v_line_number
  FROM public.ct_donghinhanban
  WHERE rtrim(mact_don) ~ '^CB[0-9]{8}$';

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF coalesce(btrim(v_item->>'mamypham'), '') = ''
       OR coalesce(v_item->>'soluong', '') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Thông tin sản phẩm hoặc số lượng không hợp lệ.';
    END IF;
    v_product_id := btrim(v_item->>'mamypham');
    v_quantity := (v_item->>'soluong')::integer;
    IF v_quantity < 1 THEN
      RAISE EXCEPTION 'Số lượng mỗi sản phẩm phải từ 1 trở lên.';
    END IF;

    UPDATE public.mypham
    SET soluongtonkho = soluongtonkho - v_quantity
    WHERE mamypham = v_product_id AND phanloai = 'Bán lẻ' AND soluongtonkho >= v_quantity
    RETURNING giaban INTO v_unit_price;
    IF v_unit_price IS NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.mypham WHERE mamypham = v_product_id AND phanloai = 'Bán lẻ') THEN
        RAISE EXCEPTION 'Sản phẩm không tồn tại hoặc không thuộc loại bán lẻ.';
      END IF;
      RAISE EXCEPTION 'Sản phẩm không đủ số lượng tồn kho.';
    END IF;

    SELECT coalesce(sum(soluongtonlo), 0)::integer INTO v_stock
    FROM public.lohang
    WHERE mamypham = v_product_id AND hansudung >= current_date;
    IF v_stock < v_quantity THEN
      RAISE EXCEPTION 'Lô hàng còn hạn không đủ số lượng tồn kho.';
    END IF;
    v_total := v_total + v_unit_price * v_quantity;
  END LOOP;

  INSERT INTO public.donghinhanban (madon, ngaymua, tongtien, matk, makhachhang)
  VALUES (v_sale_id, current_timestamp, v_total, v_account, btrim(p_makhachhang));

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := btrim(v_item->>'mamypham');
    v_quantity := (v_item->>'soluong')::integer;
    SELECT giaban INTO v_unit_price FROM public.mypham WHERE mamypham = v_product_id;
    v_remaining := v_quantity;

    FOR v_lot IN
      SELECT malo, soluongtonlo
      FROM public.lohang
      WHERE mamypham = v_product_id AND soluongtonlo > 0 AND hansudung >= current_date
      ORDER BY hansudung, malo
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining = 0;
      v_take := least(v_remaining, v_lot.soluongtonlo);
      UPDATE public.lohang SET soluongtonlo = soluongtonlo - v_take WHERE malo = v_lot.malo;
      v_line_id := ('CB' || lpad(v_line_number::text, 8, '0'))::char(10);
      INSERT INTO public.ct_donghinhanban (mact_don, soluong, dongia, thanhtien, madon, malo)
      VALUES (v_line_id, v_take, v_unit_price, v_unit_price * v_take, v_sale_id, v_lot.malo);
      v_line_number := v_line_number + 1;
      v_remaining := v_remaining - v_take;
    END LOOP;
    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Lô hàng còn hạn không đủ số lượng tồn kho.';
    END IF;
  END LOOP;

  RETURN rtrim(v_sale_id);
END;
$$;

COMMIT;
