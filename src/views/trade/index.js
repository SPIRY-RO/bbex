import React, { Component } from 'react';
import { Tabs, Input, Table, Menu, Dropdown, Icon, Tooltip, Button, Select, message } from 'antd';
import NoticeBar from '../../components/noticeBar';
import classnames from 'classnames';
import Scrollbars from 'react-custom-scrollbars';
import request from '../../utils/request';
import { stampToDate, getQueryString } from '../../utils';
import { WS_ADDRESS } from '../../utils/constants';
import TradeBox from './TradeBox';
import Tradeview from '../../tradeview';

import './trade.css';

const Search = Input.Search;
const TabPane = Tabs.TabPane;
const Option = Select.Option;

class Trade extends Component {
  state = {
    market: getQueryString('market') || 'BTC',
    coinList: null,
    marketName: getQueryString('market') || 'BTC',
    coinName: getQueryString('coin') || 'ETH',
    tradeList: null,
    streamList: null,
    pendingOrderList: [],
    completedOrderList: [],
    coinPrice: '0.00000878 &asymp;￥0.54',
    listType: -1,
    mergeNumber: 8
  };

  favoriteCoins = localStorage.getItem('favoriteCoins')
    ? JSON.parse(localStorage.getItem('favoriteCoins'))
    : [];

  componentWillMount() {
    if (sessionStorage.getItem('account')) {
      const { marketName, coinName } = this.state;
      this.findOrderList({ marketName, coinName, status: 0 });
    }
  }

  // 未完成订单
  findOrderList = ({ marketName, coinName, status }) => {
    const { id } = JSON.parse(sessionStorage.getItem('account'));
    request('/order/findOrderProposeList', {
      body: {
        status,
        userId: id,
        coinMain: marketName,
        coinOther: coinName
      }
    }).then(json => {
      if (json.code === 10000000) {
        console.log(json.data);
        if (status === 0) {
          this.setState({ pendingOrderList: json.data });
        } else {
          this.setState({ completedOrderList: json.data });
        }
      } else {
        message.error(json.message);
      }
    });
  };

  // 撤单
  cancelTrade = orderNo => {
    request(`/trade/cancelTrade/${orderNo}`, {
      method: 'GET'
    }).then(json => {
      if (json.code === 10000000) {
        message.success('撤单成功！');
      } else {
        message.error(json.message);
      }
    });
  };

  // 订单详情
  getOrderDetail = (orderNo) => {
    request(`/coin/tradeOrderDetail/${orderNo}`, {
      method: 'GET'
    }).then(json => {
      if (json.code === 10000000) {
        console.log(json.data);
      } else {
        message.error(json.message);
      }
    });
  }

  componentDidMount() {
    const { marketName, coinName } = this.state;
    this.getCoinList();
    this.getStream({
      coinMain: marketName,
      coinOther: coinName
    });
    this.getTradeList({
      coinMain: marketName,
      coinOther: coinName
    });

    //打开websockets
    var ws = new window.ReconnectingWebSocket(
      `${WS_ADDRESS}/bbex/websocket?${coinName}_${marketName}`
    );
    ws.onopen = evt => {
      console.log('Connection open ...');
      ws.send('Hello bbex!');
    };

    ws.onmessage = evt => {
      const record = JSON.parse(evt.data);
      console.log('======record: ', record);

      const { tradeList, streamList } = this.state;
      if (record.buyOrderVO) {
        tradeList.buyOrderVOList.push(record.buyOrderVO);
        tradeList.buyOrderVOList = tradeList.buyOrderVOList.sort((x, y) => y.price - x.price);
      }
      if (record.sellOrderVO) {
        tradeList.sellOrderVOList.push(record.sellOrderVO);
        tradeList.sellOrderVOList = tradeList.sellOrderVOList.sort((x, y) => y.price - x.price);
      }
      if (record.matchStreamVO) {
        streamList.unshift(record.matchStreamVO);
      }

      this.setState({ tradeList, streamList });
    };

    ws.onclose = evt => {
      console.log('Connection closed.');
    };

    ws.onerror = evt => {
      console.log(evt);
    };

    this.setState({ ws });
  }

  componentWillUnmount() {
    if (JSON.parse(sessionStorage.getItem('account'))) {
      this.state.ws.close();
    }
  }

  componentWillUpdate(nextProps, nextState) {
    if (
      this.state.marketName !== nextState.marketName ||
      this.state.coinName !== nextState.coinName
    ) {
      const { marketName, coinName } = nextState;
      this.getStream({
        coinMain: marketName,
        coinOther: coinName
      });
      this.getTradeList({
        coinMain: marketName,
        coinOther: coinName
      });
    }
  }

  componentWillUnmount() {
    const { coinList } = this.state;
    if (coinList) {
      const favoriteCoins = [];
      Object.keys(coinList).forEach(key => {
        coinList[key].forEach(coin => {
          if (coin.favorite && !favoriteCoins.includes(`${coin.coinMain}.${coin.coinOther}`)) {
            favoriteCoins.push(`${coin.coinMain}.${coin.coinOther}`);
          }
        });
      });
      localStorage.setItem('favoriteCoins', JSON.stringify(favoriteCoins));
    }
  }

  // 获取币种列表
  getCoinList = () => {
    request('/index/allTradeExpair', {
      method: 'GET'
    }).then(json => {
      if (json.code === 10000000) {
        let coinList = {};
        Object.keys(json.data).forEach(key => {
          const coins = json.data[key].map(coin => {
            if (this.favoriteCoins.includes(`${coin.coinMain}.${coin.coinOther}`)) {
              coin.favorite = true;
            }
            return coin;
          });
          coinList[key] = coins;
          this.setState({ coinList });
        });
      } else {
        message.error(json.message);
      }
    });
  };

  // 获取交易列表
  getTradeList = ({ coinMain, coinOther }) => {
    request('/index/buyAndSellerOrder', {
      method: 'GET',
      body: { coinMain, coinOther }
    }).then(json => {
      if (json.code === 10000000) {
        this.setState({ tradeList: json.data });
      } else {
        message.error(json.message);
      }
    });
  };

  // 获取流水记录
  getStream = ({ coinMain, coinOther }) => {
    request('/index/findMatchStream', {
      method: 'GET',
      body: { coinMain, coinOther }
    }).then(json => {
      if (json.code === 10000000) {
        this.setState({ streamList: json.data });
      } else {
        message.error(json.message);
      }
    });
  };

  // 切换市场
  switchMarket = obj => {
    this.setState({ market: obj.key });
  };

  // 收藏币种
  collectCoin = (event, selectedCoin) => {
    event.stopPropagation();

    const { coinList } = this.state;
    Object.keys(coinList).forEach(key => {
      const coins = coinList[key].map(coin => {
        if (selectedCoin.coinMain === coin.coinMain && selectedCoin.coinOther === coin.coinOther) {
          if (coin.favorite) {
            delete coin.favorite;
          } else {
            coin.favorite = true;
          }
        }
        return coin;
      });
      coinList[key] = coins;
    });

    this.setState({ coinList });
  };

  // 根据币种跳转市场
  jumpMarket = obj => {
    // window.location.assign(`/trade?market=${obj.key}&coin=${this.state.coinName}`);
    this.props.history.push(`/trade?market=${obj.key}&coin=${this.state.coinName}`);
    this.setState({
      market: obj.key,
      marketName: obj.key,
      coinPrice: obj.item.props.children
        .join('')
        .split(' ')[1]
        .replace('/', '&nbsp;&asymp;')
    });
  };

  // 选择币种
  selectCoin = coin => {
    const { market } = this.state;
    // window.location.assign(`/trade?market=${market}&coin=${coin.coinOther}`);
    this.props.history.push(`/trade?market=${market}&coin=${coin.coinOther}`);
    this.setState({
      marketName: market,
      coinName: coin.coinOther
    });

    if (sessionStorage.getItem('account')) {
      this.findOrderList({
        marketName: market,
        coinName: coin.coinOther
      });
    }
  };

  // 按小数位数合并列表
  handleMerge = value => {
    const { listType } = this.state;
    this.setState({ mergeNumber: value });
    this.requestMerge({
      type: listType,
      length: value
    });
  };

  requestMerge = ({ type, length }) => {
    const { marketName, coinName } = this.state;
    request('/index/merge', {
      method: 'GET',
      body: {
        coinMain: marketName,
        coinOther: coinName,
        type,
        length
      }
    }).then(json => {
      if (json.code === 10000000) {
        const { tradeList } = this.state;
        if (json.data.buyOrderVOList) tradeList.buyOrderVOList = json.data.buyOrderVOList;
        if (json.data.sellOrderVOList) tradeList.sellOrderVOList = json.data.sellOrderVOList;
        this.setState({ tradeList });
      } else {
        message.error(json.message);
      }
    });
  };

  // 切换列表
  switchList = index => {
    this.setState({ listType: index - 1 });
    this.requestMerge({
      type: index - 1,
      length: this.state.mergeNumber
    });
  };

  render() {
    const {
      market,
      coinList,
      marketName,
      coinName,
      tradeList,
      streamList,
      pendingOrderList,
      completedOrderList,
      coinPrice,
      listType
    } = this.state;

    let pairList = [];
    if (coinList) {
      if (market === 'optional') {
        Object.values(coinList).forEach(coins => {
          coins = coins.filter(coin => coin.favorite);
          Object.assign(pairList, coins);
        });
      } else {
        pairList = coinList[market] || [];
      }
    }

    const orderColumns = [
      {
        title: '委托时间',
        dataIndex: 'time',
        key: 'time',
        render: (text, record) => stampToDate(Number(text), 'YYYY-MM-DD hh:mm:ss')
      },
      {
        title: '委托类别',
        dataIndex: 'exType',
        key: 'exType',
        render: (text, record) => {
          if(text === 0) {
            return <span className="font-color-green">买入</span>;
          } else {
            return <span className="font-color-red">卖出</span>;
          }
        }
      },
      {
        title: '委托价格',
        dataIndex: 'price',
        key: 'price'
      },
      {
        title: '委托数量',
        dataIndex: 'volume',
        key: 'volume'
      },
      {
        title: '委托金额',
        dataIndex: 'amount',
        key: 'amount',
        render: (text, record) => record.price * record.volume
      },
      {
        title: '成交量',
        dataIndex: 'successVolume',
        key: 'successVolume'
      },
      {
        title: '状态/操作',
        dataIndex: 'status',
        key: 'status',
        render: (text, record) => {
          if (record.status === 2 || record.status === 3) {
            return (
              <Button type="primary" onClick={this.getOrderDetail.bind(this, record.orderNo)}>
                详情
              </Button>
            );
          } else if(record.status === 0 || record.status === 1) {
            return (
              <Button type="primary" onClick={this.cancelTrade.bind(this, record.orderNo)}>
                撤单
              </Button>
            );
          }else {
            return '--';
          }
        }
      }
    ];

    let currentCoin = {
      highestPrice: '0.00000000',
      lowerPrice: '0.00000000',
      dayCount: '0.00000000',
      change: 0,
      trend: 'green'
    };
    if (coinList && coinList.length > 0) {
      Object.values(coinList).forEach(value => {
        value.forEach(coin => {
          if (coin.coinOther === coinName) {
            currentCoin = Object.assign(currentCoin, coin);
            currentCoin.change = (coin.latestPrice - coin.firstPrice) / coin.firstPrice || 0;
            currentCoin.trend = currentCoin.change > 0 ? 'green' : 'red';
          }
        });
      });
    }

    console.log('----currentCoin: ', currentCoin);

    return (
      <div className="content trade">
        <div className="content-inner">
          <NoticeBar />
        </div>
        <div className="content-inner trade-area clear">
          <div className="trade-left">
            <div className="trade-plate">
              <header className="trade-plate-header">
                <Dropdown
                  overlay={
                    <Menu onClick={this.switchMarket}>
                      {['optional', 'BTC', 'ETH', 'USDT'].map(market => {
                        return (
                          <Menu.Item key={market}>
                            {market === 'optional' ? '自选' : `${market}市场`}
                          </Menu.Item>
                        );
                      })}
                    </Menu>
                  }
                  getPopupContainer={() => document.querySelector('.content.trade')}
                >
                  <a className="ant-dropdown-link" href="javascript:;">
                    {market === 'optional' ? '自选' : `${market}市场`}&nbsp;&nbsp;<Icon type="down" />
                  </a>
                </Dropdown>
                <div className="trade-plate-header-right">
                  <Search onSearch={value => console.log(value)} style={{ width: 80 }} />
                </div>
              </header>
              <div className="trade-plate-tit cell-3">
                <div className="trade-plate-tit-cell">币种</div>
                <div className="trade-plate-tit-cell sorter">
                  最新价
                  <div className="ant-table-column-sorter">
                    <span className="ant-table-column-sorter-up on" title="↑">
                      <i className="anticon anticon-caret-up" />
                    </span>
                    <span className="ant-table-column-sorter-down off" title="↓">
                      <i className="anticon anticon-caret-down" />
                    </span>
                  </div>
                </div>
                <div className="trade-plate-tit-cell sorter">
                  涨跌幅
                  <div className="ant-table-column-sorter">
                    <span className="ant-table-column-sorter-up off" title="↑">
                      <i className="anticon anticon-caret-up" />
                    </span>
                    <span className="ant-table-column-sorter-down off" title="↓">
                      <i className="anticon anticon-caret-down" />
                    </span>
                  </div>
                </div>
              </div>
              <div className="trade-plate-container market">
                <Scrollbars>
                  <table>
                    <tbody>
                      {pairList.map(coin => {
                        const change = (coin.latestPrice - coin.firstPrice) / coin.firstPrice || 0;
                        const trend = change > 0 ? 'green' : 'red';
                        return (
                          <tr
                            key={coin.coinOther}
                            onClick={this.selectCoin.bind(this, coin)}
                            className={classnames({
                              selected: coin.coinMain === marketName && coin.coinOther === coinName
                            })}
                          >
                            <td>
                              <i
                                className={classnames({
                                  iconfont: true,
                                  'icon-shoucang': !coin.favorite,
                                  'icon-shoucang-active': coin.favorite
                                })}
                                onClick={event => {
                                  this.collectCoin(event, coin);
                                }}
                              />
                              {coin.coinOther}
                            </td>
                            <td>{coin.latestPrice}</td>
                            <td className={`font-color-${trend}`}>{change.toFixed(2)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Scrollbars>
              </div>
            </div>
            <div className="trade-plate">
              <header className="trade-plate-header">
                <span className="trade-plate-header-text">最新成交</span>
              </header>
              <div className="trade-plate-tit cell-3">
                <div className="trade-plate-tit-cell">成交时间</div>
                <div className="trade-plate-tit-cell">成交价格</div>
                <div className="trade-plate-tit-cell">成交量</div>
              </div>
              <div className="trade-plate-container">
                <Scrollbars>
                  <table>
                    <tbody>
                      {streamList &&
                        streamList.map(stream => {
                          const trend = stream.type === 0 ? 'green' : 'red';
                          return (
                            <tr key={stream.date} className={`font-color-${trend}`}>
                              <td>{stampToDate(Number(stream.date), 'hh:mm:ss')}</td>
                              <td>{stream.price}</td>
                              <td>{stream.volume}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </Scrollbars>
              </div>
            </div>
          </div>
          <div className="trade-center">
            <div className="trade-plate">
              <header className="trade-plate-header">
                <Dropdown
                  overlay={
                    <Menu onClick={this.jumpMarket}>
                      {[
                        {
                          marketName: 'BTC',
                          pairPrice: '0.00000877',
                          pairCNY: '￥0.54'
                        },
                        {
                          marketName: 'USDT',
                          pairPrice: '0.514',
                          pairCNY: '￥0.54'
                        },
                        {
                          marketName: 'ETH',
                          pairPrice: '0.00010951',
                          pairCNY: '￥0.54'
                        }
                      ].map(market => {
                        return (
                          <Menu.Item key={market.marketName}>
                            {coinName}/{market.marketName} {market.pairPrice}/{market.pairCNY}
                          </Menu.Item>
                        );
                      })}
                    </Menu>
                  }
                  getPopupContainer={() => document.querySelector('.content.trade')}
                >
                  <a className="ant-dropdown-link" href="javascript:;">
                    {coinName}/{marketName}&nbsp;&nbsp;<Icon type="down" />
                  </a>
                </Dropdown>
                <span
                  className="trade-plate-header-price"
                  dangerouslySetInnerHTML={{
                    __html: coinPrice
                  }}
                />
                <div className="trade-plate-header-right">
                  <Tooltip
                    placement="rightTop"
                    title={`波场TRON是全球最大的区块链去中心化应用操作系统,
                    波场TRON以推动互联网去中心化为己任，
                    致力于为去中心化互联网搭建基础设施。
                    旗下的波场TRON协议是全球最大的基于区块链的去中心化应用操作系统协议之一，
                    为协议上的去中心化应用运行提供高吞吐，高扩展，高可靠性的底层公链支持。`}
                  >
                    <Button type="introduction">币种介绍</Button>
                  </Tooltip>
                </div>
              </header>
              <div className="trade-plate-tit Kline">
                <div className="trade-plate-tit-cell">
                  最高<strong>{currentCoin.highestPrice}</strong>
                </div>
                <div className="trade-plate-tit-cell">
                  最低<strong>{currentCoin.lowerPrice}</strong>
                </div>
                <div className="trade-plate-tit-cell">
                  成交量<strong>{currentCoin.dayCount}</strong>
                </div>
                <div className="trade-plate-tit-cell">
                  涨跌幅
                  <strong className={`font-color-${currentCoin.trend}`}>
                    {currentCoin.change.toFixed(2)}%
                  </strong>
                </div>
              </div>
              <div className="trade-plate-container">
                <Tradeview market={marketName} coin={coinName} />
              </div>
            </div>
            <div className="trade-plate">
              <Tabs defaultActiveKey="1">
                <TabPane tab="限价交易" key="1">
                  <TradeBox marketName={marketName} coinName={coinName} tradeType="limit" />
                </TabPane>
                <TabPane tab="市价交易" key="2">
                  <TradeBox marketName={marketName} coinName={coinName} tradeType="market" />
                </TabPane>
                {false && (
                  <TabPane
                    tab={
                      <span>
                        止盈止损
                        <Tooltip
                          placement="rightTop"
                          title={`当市场价达到触发价时，将按计划设定的价格和数量进行下单`}
                        >
                          <i className="iconfont icon-web-icon-" />
                        </Tooltip>
                      </span>
                    }
                    key="3"
                  >
                    <TradeBox marketName={marketName} coinName={coinName} tradeType="stop" />
                  </TabPane>
                )}
              </Tabs>
            </div>
          </div>
          <div className="trade-right">
            <div className="trade-plate">
              <header className="trade-plate-header">
                <div className="trade-plate-tab">
                  {['icon-maimaipan', 'icon-maipan1', 'icon-maipan'].map((iconName, index) => {
                    const mapToTitle = {
                      'icon-maimaipan': 'buy and sell',
                      'icon-maipan1': 'buy',
                      'icon-maipan': 'sell'
                    };
                    return (
                      <i
                        key={iconName}
                        className={classnames({
                          iconfont: true,
                          [iconName]: true,
                          active: listType === index - 1
                        })}
                        title={mapToTitle[iconName]}
                        onClick={this.switchList.bind(this, index)}
                      />
                    );
                  })}
                </div>
                <div className="trade-plate-header-right">
                  合并
                  <Select
                    defaultValue="8"
                    style={{ width: 100 }}
                    dropdownClassName="merge-dropdown"
                    onChange={this.handleMerge}
                  >
                    <Option value="8">8位小数</Option>
                    <Option value="6">6位小数</Option>
                    <Option value="4">4位小数</Option>
                  </Select>
                </div>
              </header>
              {listType === -1 ? (
                <div className="trade-plate-tit list">
                  <div className="trade-plate-tit-cell">类型</div>
                  <div className="trade-plate-tit-cell">价格({marketName})</div>
                  <div className="trade-plate-tit-cell">数量({coinName})</div>
                  {false && <div className="trade-plate-tit-cell">交易额({marketName})</div>}
                </div>
              ) : (
                <div className="trade-plate-tit list">
                  <div className="trade-plate-tit-cell">{listType === 0 ? '买入' : '卖出'}</div>
                  <div className="trade-plate-tit-cell">{listType === 0 ? '买入' : '卖出'}价</div>
                  <div className="trade-plate-tit-cell">委单量</div>
                  {false && <div className="trade-plate-tit-cell">交易额({marketName})</div>}
                </div>
              )}
              {listType === -1 ? (
                <div className="trade-plate-list">
                  <table>
                    <tbody>
                      {tradeList &&
                        tradeList.sellOrderVOList.map((record, index, arr) => {
                          const length = arr.length < 15 ? arr.length : 15;
                          return (
                            index < length && (
                              <tr key={index}>
                                <td className="font-color-red">卖出{length - index}</td>
                                <td>{record.price}</td>
                                <td>{record.volume}</td>
                                {false && <td className="font-color-red">{record.sumTotal}</td>}
                              </tr>
                            )
                          );
                        })}
                    </tbody>
                  </table>
                  <div className="latest-price">
                    <span>
                      <i className="iconfont icon-xinhao font-color-green" />最新价
                    </span>
                    <span
                      className={
                        streamList &&
                        streamList.length > 0 &&
                        streamList[0].price <
                          (streamList[1] ? streamList[1].price : streamList[0].price)
                          ? 'font-color-red'
                          : 'font-color-green'
                      }
                    >
                      {streamList && streamList.length > 0 && streamList[0].price}
                      <i
                        className={classnames({
                          iconfont: true,
                          'icon-xiajiang':
                            streamList &&
                            streamList.length > 0 &&
                            streamList[0].price <
                              (streamList[1] ? streamList[1].price : streamList[0].price),
                          'icon-shangsheng':
                            streamList &&
                            streamList.length > 0 &&
                            streamList[0].price >=
                              (streamList[1] ? streamList[1].price : streamList[0].price)
                        })}
                      />
                    </span>
                  </div>
                  <table>
                    <tbody>
                      {tradeList &&
                        tradeList.buyOrderVOList.map((record, index) => {
                          return (
                            index < 15 && (
                              <tr key={index}>
                                <td className="font-color-green">买入{index + 1}</td>
                                <td>{record.price}</td>
                                <td>{record.volume}</td>
                                {false && <td className="font-color-green">{record.sumTotal}</td>}
                              </tr>
                            )
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="trade-plate-list">
                  <Scrollbars>
                    <table>
                      <tbody>
                        {tradeList &&
                          (listType === 1
                            ? tradeList.sellOrderVOList
                            : tradeList.buyOrderVOList
                          ).map((record, index) => {
                            const colorName = listType === 0 ? 'green' : 'red';
                            const actionName = listType === 0 ? '买入' : '卖出';
                            return (
                              <tr key={index}>
                                <td className={`font-color-${colorName}`}>
                                  {actionName}
                                  {index + 1}
                                </td>
                                <td>{record.price}</td>
                                <td>{record.volume}</td>
                                <td className={`font-color-${colorName}`}>{record.sumTotal}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </Scrollbars>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="content-inner">
          <div className="trade-plate">
            <Tabs
              defaultActiveKey="0"
              onChange={status => {
                this.findOrderList({ marketName, coinName, status });
              }}
            >
              <TabPane tab="我的挂单" key="0">
                <Table columns={orderColumns} dataSource={pendingOrderList} pagination={false} />
              </TabPane>
              <TabPane tab="成交历史" key="1">
                <Table columns={orderColumns} dataSource={completedOrderList} pagination={false} />
              </TabPane>
            </Tabs>
          </div>
        </div>
      </div>
    );
  }
}

export default Trade;
