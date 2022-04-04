import React, { useState, useEffect, useContext } from 'react'
import { Select, Card, Form, Button, Input, Modal, Divider, Checkbox, message, Table } from 'antd';
import { DeleteFilled } from '@ant-design/icons';
import { APP_PREFIX_PATH, API_BASE_URL } from 'configs/AppConfig'
import Loading from 'components/shared-components/Loading'
import axios from 'axios'
import { UserContext } from 'contexts/UserContext';

const { Option } = Select;

const onFinish = async (data, setLoading, history) => {
  setLoading(true)
  const jwt = localStorage.getItem('jwt')

  try {
    const options = {
      url: `${API_BASE_URL}/quote/`,
      method: 'PUT',
      data,
      headers: {
        "Content-Type": "application/json",
        'jwt-token': jwt
      }
    }
    await axios.request(options)
    message.success({ content: 'Cotizacion editada' })
    history.push(`${APP_PREFIX_PATH}/quotes`)
  } catch (error) {
    message.error({ content: 'Something went wrong' })
    console.error(error);
    setLoading(false)
  }
}

const getStock = async (sku) => {
  const jwt = localStorage.getItem('jwt')
  // Get the stock of a product
  try {
    const options = {
      url: `${API_BASE_URL}/product/stock/${sku}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'jwt-token': jwt
      }
    }
    const stock = (await axios.request(options)).data
    return stock
  } catch (error) {
    message.error({ content: `No se pudo cargar el stock de ${sku}` })
    return []
  }
}

const EditQuote = ({ history, match }) => {
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState([])
  const [customer, setCustomer] = useState(0)
  const [products, setProducts] = useState([])
  const [markings, setMarkings] = useState([])
  const [stock, setStock] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [quote, setQuote] = useState({ customer: null, wayToPay: '', validityPeriod: '', deliveryTime: '', seller: '', products: [{ product: null, price: 0, typeOfPrice: 'net', priceDescription: '', freight: 0, profit: 0, markings: [{ netPrice: 0, amount: 0, markingPrice: 0, unitPrice: 0, totalPrice: 0, name: null, ink: null, i: null }], discount: false, observations: '' }] })
  const { user } = useContext(UserContext)
  const quoteId = match.params.quoteid

  useEffect(() => {
    const CancelToken = axios.CancelToken.source();
    const init = async () => {
      const jwt = localStorage.getItem('jwt')
      // Get the list of customers
      try {
        let options = {
          url: API_BASE_URL + '/customer/',
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'jwt-token': jwt
          }
        }
        let res = await axios.request(options)
        setCustomers(res.data)
      } catch (error) {
        console.error(error);
      }
      try {
        const options = {
          url: API_BASE_URL + '/quote/' + quoteId,
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'jwt-token': jwt
          }
        }
        const res = (await axios.request(options)).data
        setQuote(res)
      } catch (error) {
        console.error(error);
      }
      // Get the list of products
      try {
        let options = {
          url: API_BASE_URL + '/product/',
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'jwt-token': jwt
          }
        }
        let res = await axios.request(options)
        setProducts(res.data)
      } catch (error) {
        console.error(error);
      }
      // Get the list of markings
      try {
        let options = {
          url: API_BASE_URL + '/marking/',
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'jwt-token': jwt
          }
        }
        let res = await axios.request(options)
        setMarkings(res.data)
      } catch (error) {
        console.error(error);
      }
      setLoading(false)
    }
    init()
    return () => CancelToken.cancel('Cancelling in cleanup')// eslint-disable-next-line
  }, [])

  const onChangeCustomer = (i) => {
    setCustomer(i)
    let aux = { ...quote }
    aux.customer = customers[i]
    setQuote(aux)
  }

  const calculatePrices = (product) => {
    product.markings.forEach((mark, j) => {
      switch (product.typeOfPrice) {
        case 'net':
          mark.netPrice = product.price
          break;
        case 'offer':
          mark.netPrice = (product.price * 0.6) * 0.85
          break;
        case 'full':
          mark.netPrice = product.price * 0.6
          if (product.discount && user.discount && user.discount.ranges.length > 0) {
            let inRange = false
            for (const range of user.discount.ranges) {
              if (mark.amount * mark.netPrice >= range.min && mark.amount * mark.netPrice <= range.max) {
                mark.netPrice = (product.price * 0.6) * ((100 - range.discount) / 100)
                inRange = true
                break
              } else if (mark.amount * mark.netPrice < range.min) inRange = true
            }
            if (!inRange) {
              mark.netPrice = (product.price * 0.6) * ((100 - user.discount.outOfRangeDiscount) / 100)
            }
          }
          break;
        default:
          break;
      }

      let sum = 0
      if (mark.ink) {
        let inRange = false
        for (const ran of mark.ink.ranges) {
          if (mark.amount >= ran.min && mark.amount <= ran.max) {
            sum = mark.amount * ran.price
            inRange = true
            break
          } else if (mark.amount < ran.min) {
            sum = mark.ink.minTotalPrice
            inRange = true
          }
        }
        if (!inRange) {
          sum += mark.ink.outOfRangePrice * mark.amount
        }
      }
      if (sum > 0) {
        product.markings[j].markingPrice = sum / mark.amount
      } else product.markings[j].markingPrice = 0
      product.markings[j].unitPrice = (parseFloat(mark.netPrice) + parseFloat(product.markings[j].markingPrice) + parseFloat(product.freight)) / (product.profit > 0 ? ((100 - product.profit) / 100) : 1)
      product.markings[j].totalPrice = product.markings[j].unitPrice * mark.amount
    });
    return product
  }

  const openStock = async (sku) => {
    setStock('loading')
    setIsOpen(true)
    setStock(await getStock(sku))
  }

  const addProduct = () => {
    let aux = { ...quote }
    aux.products.push({ product: null, price: 0, typeOfPrice: 'net', priceDescription: '', freight: 0, profit: 0, markings: [{ netPrice: 0, amount: 0, markingPrice: 0, unitPrice: 0, totalPrice: 0, name: null, ink: null, i: null }], discount: false, observations: '' })
    setQuote(aux)
  }

  const deleteProduct = (i) => {
    let aux = { ...quote }
    aux.products.splice(i, 1)
    setQuote(aux)
  }

  const onChangeProduct = (j, i) => {
    let aux = { ...quote }
    aux.products[i].product = products[j]
    if (aux.products[i].product.prices[0]) {
      aux.products[i].price = aux.products[i].product.prices[0].price
      aux.products[i].priceDescription = aux.products[i].product.prices[0].description
    }
    aux.products[i] = calculatePrices(aux.products[i])
    setQuote(aux)
  }

  const onChangeHandler = (v, i) => {
    const value = v.target.value.toString().replace(/\$\s?|(,*)/g, '')
    if (!value.match(/^-?\d+$/) && value !== '') return
    if (value < 0) return
    let aux = { ...quote }
    aux.products[i][v.target.name] = value !== '' ? parseInt(value) : 0
    aux.products[i] = calculatePrices(aux.products[i])
    setQuote(aux)
  }

  const onChangeHandlerMark = (v, i, j) => {
    const value = v.target.value.toString().replace(/\$\s?|(,*)/g, '')
    if (!(value.match(/^\d+\.\d+$/) || value.match(/^\d+$/)) && value !== '') return
    if (value < 0) return
    let aux = { ...quote }
    if (v.target.name === 'amount') {
      aux.products[i].markings[j][v.target.name] = value !== '' ? parseInt(value) : 0
    } else {
      aux.products[i].markings[j][v.target.name] = value !== '' ? parseFloat(value).toFixed(2) : 0
    }
    if (v.target.name !== 'totalPrice' || v.target.name === 'amount') aux.products[i] = calculatePrices(aux.products[i])
    setQuote(aux)
  }

  const addMarking = (i) => {
    let aux = { ...quote }
    aux.products[i].markings.push({ netPrice: 0, amount: 0, markingPrice: 0, unitPrice: 0, totalPrice: 0, name: null, ink: null, i: null })
    setQuote(aux)
  }

  const onChangeMarking = (i, j, k) => {
    let aux = { ...quote }
    aux.products[i].markings[j].name = markings[k].name
    aux.products[i].markings[j].i = k
    aux.products[i].markings[j].ink = null
    aux.products[i] = calculatePrices(aux.products[i])
    setQuote(aux)
  }

  const onChangeInk = (i, j, k) => {
    let aux = { ...quote }
    aux.products[i].markings[j].ink = markings[aux.products[i].markings[j].i].inks[k]
    aux.products[i] = calculatePrices(aux.products[i])
    setQuote(aux)
  }

  const deleteMarking = (i, j) => {
    let aux = { ...quote }
    aux.products[i].markings.splice(j, 1)
    setQuote(aux)
  }

  const onChangePrice = (i, j) => {
    let aux = { ...quote }
    aux.products[i].price = aux.products[i].product.prices[j].price
    aux.products[i].priceDescription = aux.products[i].product.prices[j].description
    aux.products[i] = calculatePrices(aux.products[i])
    setQuote(aux)
  }

  const onTypePriceChange = (i, v) => {
    let aux = { ...quote }
    aux.products[i].typeOfPrice = v
    aux.products[i] = calculatePrices(aux.products[i])
    setQuote(aux)
  }

  const onChangeObservations = (i, v) => {
    let aux = { ...quote }
    aux.products[i].observations = v.target.value
    setQuote(aux)
  }

  const applyDiscount = (v, i) => {
    let aux = { ...quote }
    aux.products[i].discount = v.target.checked
    aux.products[i] = calculatePrices(aux.products[i])
    setQuote(aux)
  }

  if (loading) return (
    <div>
      <Loading cover="content" />
    </div>
  )

  const columns = [
    {
      title: 'Bodega Local',
      dataIndex: 'bodegaLocal',
      key: 'bodegaLocal',
    },
    {
      title: 'Bodega Zona Franca',
      dataIndex: 'bodegaZonaFranca',
      key: 'bodegaZonaFranca',
    },
    {
      title: 'Cantidad Transito',
      dataIndex: 'cantidadTransito',
      key: 'cantidadTransito',
    },
    {
      title: 'Color',
      dataIndex: 'color',
      key: 'color',
    },
    {
      title: 'Estado de la orden',
      dataIndex: 'estadoOrden',
      key: 'estadoOrden',
    },
    {
      title: 'Llegada Bodega Local',
      dataIndex: 'llegadaBodegaLocal',
      key: 'llegadaBodegaLocal',
    },
    {
      title: 'Total Disponible',
      dataIndex: 'totalDisponible',
      key: 'totalDisponible',
    },
  ]

  return (
    <div>
      <Modal
        visible={isOpen}
        onOk={() => setIsOpen(false)}
        onCancel={() => setIsOpen(false)}
        footer={<></>}
        width={1000}
      >
        {stock[0]?.referencia &&
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2>{stock[0].referencia}</h2>
          </div>
        }
        {stock !== 'loading' ?
          < Table columns={columns} dataSource={stock} rowKey='id' /> :
          <div style={{ height: '200px' }}>
            <Loading cover="content" />
          </div>
        }
      </Modal>
      <Card>
        <Form onFinish={(form) => onFinish(form, setLoading, history)}>
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
            <Form.Item label='Cliente' name={['customer']} rules={[{ required: true }]}>
              <Select
                showSearch
                style={{ width: 200 }}
                placeholder="Selecciona un cliente"
                optionFilterProp="children"
                value={customer}
                onChange={onChangeCustomer}
                filterOption={(input, option) =>
                  option.props.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
              >
                {customers.map((p, i) => (
                  <Option value={i} key={p._id}>{p.name}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="Vendedor">
              <Input
                name='seller'
                value={quote.seller}
                placeholder='Vendedor'
                style={{ width: 150 }}
                onChange={(v) => setQuote({ ...quote, seller: v.target.value })} />
            </Form.Item>
            <Form.Item label="Tiempo de entrega">
              <Input
                name='deliveryTime'
                value={quote.deliveryTime}
                placeholder='Tiempo de entrega'
                style={{ width: 150 }}
                onChange={(v) => setQuote({ ...quote, deliveryTime: v.target.value })} />
            </Form.Item>
            <Form.Item label="Validez de la propuesta">
              <Input
                name='validityPeriod'
                value={quote.validityPeriod}
                placeholder='Validez de la propuesta'
                style={{ width: 150 }}
                onChange={(v) => setQuote({ ...quote, validityPeriod: v.target.value })} />
            </Form.Item>
            <Form.Item label="Forma de pago">
              <Input
                name='wayToPay'
                value={quote.wayToPay}
                placeholder='Forma de pago'
                style={{ width: 150 }}
                onChange={(v) => setQuote({ ...quote, wayToPay: v.target.value })} />
            </Form.Item>
          </div>
          {quote.products.map((product, i) => (
            <Card key={i}>
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                <Form.Item style={{ marginRight: '15px' }} label='Producto' rules={[{ required: true }]}>
                  <Select
                    showSearch
                    style={{ width: 200 }}
                    onChange={(v) => onChangeProduct(v, i)}
                    placeholder="Selecciona una producto"
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                      option.props.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                    }
                  >
                    {products.map((p, j) => (
                      <Option value={j} key={`${i}-${p._id}`}>{p.sku}</Option>
                    ))}
                  </Select>
                </Form.Item>
                {product.product &&
                  <Button onClick={() => openStock(product.product.sku)}>Ver Stock</Button>
                }
                <Button style={{ backgroundColor: '#ff7575' }} onClick={() => deleteProduct(i)}>
                  <DeleteFilled style={{ color: 'white', fontSize: '20px' }} />
                </Button>
              </div>
              {product.product &&
                <>
                  <Card>
                    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap' }}>
                      <Card style={{ marginRight: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <img crossOrigin={null} src={`https://catalogospromocionales.com${product.product.photo}`} style={{ objectFit: 'contain', width: '200px' }} alt={product.product.name} />
                      </Card>
                      <div style={{ width: '230px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <p style={{ marginRight: '10px', marginBottom: '0px', fontWeight: '900' }}>Nombre:</p>
                          <p style={{ marginRight: '10px', marginBottom: '0px', fontWeight: '300' }}>{product.product.name}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <p style={{ marginRight: '10px', marginBottom: '0px', fontWeight: '900' }}>SKU:</p>
                          <p style={{ marginRight: '10px', marginBottom: '0px', fontWeight: '300' }}>{product.product.sku}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <p style={{ marginRight: '10px', marginBottom: '0px', fontWeight: '900' }}>Descripcion:</p>
                          <div dangerouslySetInnerHTML={{ __html: `<div>${product.product.description}</div>` }} />
                        </div>
                        <Form.Item style={{ marginRight: '15px', width: '200px', marginBottom: '5px' }} label='Precio' rules={[{ required: true }]}>
                          <Select
                            showSearch
                            style={{ width: 200 }}
                            value={`$${product.price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`}
                            onChange={(v) => onChangePrice(i, v)}
                            placeholder="Selecciona un precio"
                            optionFilterProp="children"
                          >
                            {product.product.prices.map((p, j) => (
                              <Option value={j} key={`prices${i}-${j}`}>${p.price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</Option>
                            ))}
                          </Select>
                        </Form.Item>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <p style={{ marginRight: '10px', marginBottom: '0px', fontWeight: '900' }}>Descripcion del precio:</p>
                          <p style={{ marginRight: '10px', marginBottom: '0px', fontWeight: '300' }}>{product.priceDescription}</p>
                        </div>
                        <Form.Item style={{ marginRight: '15px', marginBottom: '5px' }} label='Tipo' rules={[{ required: true }]}>
                          <Select
                            showSearch
                            style={{ width: 200 }}
                            onChange={(v) => onTypePriceChange(i, v)}
                            placeholder="Selecciona el tipo de precio"
                            optionFilterProp="children"
                            value={product.typeOfPrice}
                            filterOption={(input, option) =>
                              option.props.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                            }
                          >
                            <Option value={'net'}>Neto</Option>
                            <Option value={'offer'}>Oferta</Option>
                            <Option value={'full'}>Normal / Full</Option>
                          </Select>
                        </Form.Item>
                        {product.typeOfPrice === 'full' &&
                          <Checkbox checked={product.discount} onChange={(v) => applyDiscount(v, i)}>
                            Aplicar descuento
                          </Checkbox>
                        }

                        <Form.Item label="Observaciones" style={{ width: 200, marginRight: '15px' }} rules={[{ required: true }]}>
                          <Input.TextArea style={{ minWidth: '220px' }} name='observations' value={product.observations} placeholder='Observaciones' onChange={(v) => onChangeObservations(i, v)} />
                        </Form.Item>
                      </div>
                      <div style={{ minWidth: '550px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Form.Item label="Flete" style={{ width: 100, marginRight: '15px', marginBottom: '0px' }} rules={[{ required: true }]}>
                            <Input
                              prefix='$'
                              name='freight'
                              value={product.freight.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              placeholder='Flete'
                              style={{ width: 100 }}
                              onChange={(v) => onChangeHandler(v, i)} />
                          </Form.Item>
                          <Form.Item label="Utilidad %" style={{ width: 70, marginRight: '15px', marginBottom: '0px' }} rules={[{ required: true }]}>
                            <Input
                              suffix='%'
                              name='profit'
                              value={product.profit.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              placeholder='Utilidad'
                              style={{ width: 70 }}
                              onChange={(v) => onChangeHandler(v, i)} />
                          </Form.Item>
                        </div>
                        <Divider style={{ margin: '15px' }} />
                        {product.markings.map((m, j) => (
                          <div key={`marking ${i}-${j}`}>
                            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Form.Item label='Marcacion' style={{ marginBottom: '0px' }} rules={[{ required: true }]}>
                                <Select
                                  showSearch
                                  style={{ width: 160 }}
                                  placeholder="Selecciona una marcación"
                                  onChange={(k) => onChangeMarking(i, j, k)}
                                  optionFilterProp="children"
                                  filterOption={(input, option) =>
                                    option.props.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                                  }
                                >
                                  {markings.map((p, k) => (
                                    <Option value={k} key={`${i}-${j}-${p._id}`}>{p.name}</Option>
                                  ))}
                                </Select>
                              </Form.Item>
                              {m.name && markings[m.i].inks.length > 0 &&
                                <Form.Item label='Tintas' style={{ marginBottom: '0px' }} rules={[{ required: true }]}>
                                  <Select
                                    showSearch
                                    style={{ width: 160 }}
                                    placeholder="Tintas"
                                    onChange={(k) => onChangeInk(i, j, k)}
                                    optionFilterProp="children"
                                    filterOption={(input, option) =>
                                      option.props.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                                    }
                                  >
                                    {markings[m.i].inks.map((ink, k) => (
                                      <Option value={k} key={`ink ${i - j - k}`}>{ink.name}</Option>
                                    ))}
                                  </Select>
                                </Form.Item>
                              }
                              <Button style={{ backgroundColor: '#ff7575' }} onClick={() => deleteMarking(i, j)}>
                                <DeleteFilled style={{ color: 'white', fontSize: '20px' }} />
                              </Button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Form.Item label="Cantidad" style={{ width: 100, marginRight: '15px' }} rules={[{ required: true }]}>
                                <Input
                                  name='amount'
                                  value={m.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                  placeholder='Cantidad'
                                  style={{ width: 100 }}
                                  onChange={(v) => onChangeHandlerMark(v, i, j)} />
                              </Form.Item>
                              <Form.Item label="Precio Neto" style={{ width: 100, marginRight: '15px' }} rules={[{ required: true }]}>
                                <Input
                                  prefix='$'
                                  value={Number.parseFloat(m.netPrice).toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                  placeholder='Precio neto'
                                  style={{ width: 110 }}
                                />
                              </Form.Item>
                              <Form.Item label="Marcacion" style={{ width: 100, marginRight: '15px' }} rules={[{ required: true }]}>
                                <Input
                                  prefix='$'
                                  name='markingPrice'
                                  value={Number.parseFloat(m.markingPrice).toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                  placeholder='Precio de marcacion'
                                  style={{ width: 110 }}
                                  onChange={(v) => onChangeHandlerMark(v, i, j)} />
                              </Form.Item>
                              <Form.Item label="Precio unitario" style={{ width: 100, marginRight: '15px' }} rules={[{ required: true }]}>
                                <Input
                                  prefix='$'
                                  name='unitPrice'
                                  value={Number.parseFloat(m.unitPrice).toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                  placeholder='Precio unitario'
                                  style={{ width: 110 }}
                                  onChange={(v) => onChangeHandlerMark(v, i, j)} />
                              </Form.Item>
                              <Form.Item label="Total" style={{ width: 130, marginRight: '15px' }} rules={[{ required: true }]}>
                                <Input
                                  prefix='$'
                                  name='totalPrice'
                                  value={Number.parseFloat(m.totalPrice).toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                  placeholder='Precio Total'
                                  style={{ width: 130 }}
                                  onChange={(v) => onChangeHandlerMark(v, i, j)} />
                              </Form.Item>
                            </div>
                            <Divider style={{ margin: '15px' }} />
                          </div>
                        ))}
                        <Button onClick={() => addMarking(i)}>
                          Agregar Marcación
                        </Button>
                      </div>
                    </div>
                  </Card>
                </>
              }
            </Card>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Button onClick={addProduct} style={{ fontSize: '25px', fontWeight: '900', height: '60px' }}>
              Agregar Producto
            </Button>
          </div>
          <Form.Item >
            <Button type="primary" onClick={() => onFinish(quote, setLoading, history)} style={{ marginTop: '15px' }}>
              Editar cotizacion
            </Button>
          </Form.Item>
        </Form>
      </Card >
    </div >
  )
}

export default EditQuote